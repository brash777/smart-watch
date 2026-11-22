/**
 * The academic integrity notice (assignment_guide_notice setting) as the first block of an
 * ASSIGNMENT_GUIDE (docs/PRODUCT.md, "Academic integrity"). It is added once.
 */
export function withAssignmentNotice(markdown: string, notice: string): string {
  const block = `> ${notice}`;
  return markdown.startsWith(block) ? markdown : `${block}\n\n${markdown}`;
}
