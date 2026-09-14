/**
 * 统计中英混合字数：汉字按字，英文按词。
 */
export function countCopyWords(text: string): number {
  const chinese = (text.match(/[\u4e00-\u9fff]/gu) ?? []).length
  const rest = text.replace(/[\u4e00-\u9fff]/gu, ' ')
  const latin = (rest.match(/[A-Za-z0-9]+/gu) ?? []).length
  return chinese + latin
}
