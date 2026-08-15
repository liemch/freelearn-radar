import { or, sql, type SQL, type SQLWrapper } from "drizzle-orm";

import { categories, courseCategories, courses, providers } from "@/db/schema";
import { courseTopicTags, topicTags } from "@/db/schema/topic-tags";
import {
  LEXICAL_TITLE_SIMILARITY_THRESHOLD,
  LEXICAL_WORD_SIMILARITY_THRESHOLD,
  prepareLexicalQuery,
  type PreparedLexicalQuery,
} from "@/domain/search/lexical";

/** `immutable_unaccent(lower(coalesce(col,'')))`, the folded form every branch compares. */
function folded(column: SQLWrapper) {
  return sql`public.immutable_unaccent(lower(coalesce(${column}, '')))`;
}

/**
 * Weighted lexical match for catalog search (M20.1 §87).
 * Relies on migration 0008: immutable_unaccent + pg_trgm.
 *
 * Each alias phrase is matched independently rather than concatenated into the
 * query, because a single LIKE over `query + alias` matches nothing.
 */
export function buildLexicalMatchCondition(rawQuery: string): SQL | null {
  const prepared = prepareLexicalQuery(rawQuery);
  if (!prepared) return null;

  const branches: SQL[] = [];

  for (const pattern of prepared.likePatterns) {
    branches.push(
      sql`${folded(courses.title)} like ${pattern} escape '\\'`,
      sql`${folded(courses.shortDescription)} like ${pattern} escape '\\'`,
      sql`${folded(courses.description)} like ${pattern} escape '\\'`,
      sql`${folded(providers.name)} like ${pattern} escape '\\'`,
      sql`exists (
        select 1
        from ${courseCategories} sc
        join ${categories} scat on scat.id = sc.category_id
        where sc.course_id = ${courses.id}
          and ${folded(sql`scat.name`)} like ${pattern} escape '\\'
      )`,
      sql`exists (
        select 1
        from ${courseTopicTags} ctt
        join ${topicTags} tt on tt.id = ctt.tag_id
        where ctt.course_id = ${courses.id}
          and (
            ${folded(sql`tt.name_en`)} like ${pattern} escape '\\'
            or ${folded(sql`tt.name_vi`)} like ${pattern} escape '\\'
            or ${folded(sql`tt.slug`)} like ${pattern} escape '\\'
          )
      )`,
    );
  }

  for (const phrase of prepared.phrases) {
    // word_similarity is the branch that actually tolerates typos: it scores the
    // best word-boundary span of the title, so a short query against a long
    // title is no longer penalised the way whole-string similarity penalises it.
    branches.push(
      sql`word_similarity(${phrase}, ${folded(courses.title)}) >= ${LEXICAL_WORD_SIMILARITY_THRESHOLD}`,
    );
  }

  branches.push(
    sql`similarity(${folded(courses.title)}, ${prepared.foldedExpanded}) >= ${LEXICAL_TITLE_SIMILARITY_THRESHOLD}`,
  );

  return or(...branches)!;
}

/**
 * Ranking score: title > topic tags > short description > description > provider,
 * plus title trigram similarity. Higher is better.
 */
export function buildLexicalRankExpression(rawQuery: string): SQL | null {
  const prepared = prepareLexicalQuery(rawQuery);
  if (!prepared) return null;
  return lexicalRankSql(prepared);
}

function lexicalRankSql(prepared: PreparedLexicalQuery): SQL {
  // The primary phrase carries full weight; alias phrases score lower so a direct
  // title hit always outranks a course reached only through an alias.
  const primary = prepared.likePatterns[0]!;
  const aliasPatterns = prepared.likePatterns.slice(1);

  const aliasTerms = aliasPatterns.map(
    (pattern) => sql`
      + (case when ${folded(courses.title)} like ${pattern} escape '\\' then 1.5 else 0 end)
      + (case when ${folded(courses.shortDescription)} like ${pattern} escape '\\' then 0.75 else 0 end)
    `,
  );

  const wordSimilarityTerms = prepared.phrases.map(
    (phrase, index) => sql`
      + (word_similarity(${phrase}, ${folded(courses.title)}) * ${index === 0 ? 2.0 : 1.0})
    `,
  );

  return sql`(
    (case when ${folded(courses.title)} like ${primary} escape '\\' then 3.0 else 0 end)
    + (case when exists (
         select 1 from ${courseTopicTags} ctt
         join ${topicTags} tt on tt.id = ctt.tag_id
         where ctt.course_id = ${courses.id}
           and (
             ${folded(sql`tt.name_en`)} like ${primary} escape '\\'
             or ${folded(sql`tt.name_vi`)} like ${primary} escape '\\'
           )
       ) then 2.0 else 0 end)
    + (case when ${folded(courses.shortDescription)} like ${primary} escape '\\' then 1.5 else 0 end)
    + (case when ${folded(courses.description)} like ${primary} escape '\\' then 1.0 else 0 end)
    + (case when ${folded(providers.name)} like ${primary} escape '\\' then 1.2 else 0 end)
    ${sql.join(aliasTerms, sql``)}
    ${sql.join(wordSimilarityTerms, sql``)}
  )`;
}
