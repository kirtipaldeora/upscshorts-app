import type { ReadingLanguage } from '@/hooks/useReadingLanguage'
import type { Article, PrelimQuestion } from '@/types/article'

const DEVANAGARI = /[\u0900-\u097F]/

function usableHindi(value: string | undefined) {
  return Boolean(value?.trim()) && DEVANAGARI.test(value ?? '') && !value?.includes('\uFFFD')
}

export function getArticleCopy(article: Article, language: ReadingLanguage) {
  if (language !== 'hi') {
    return { headline: article.headline, summary: article.summary, whyItMatters: article.whyItMatters, language: 'en' as const }
  }
  const copy = article.hindi
  if (!copy || !usableHindi(copy.headline) || !usableHindi(copy.summary) || !usableHindi(copy.whyItMatters)) {
    return { headline: article.headline, summary: article.summary, whyItMatters: article.whyItMatters, language: 'en' as const }
  }
  return { headline: copy.headline, summary: copy.summary, whyItMatters: copy.whyItMatters, language: 'hi' as const }
}

export function getPrelimQuestionCopy(
  question: PrelimQuestion,
  language: ReadingLanguage,
): PrelimQuestion {
  if (language !== 'hi') return question
  const copy = question.hindi
  if (
    !copy
    || !usableHindi(copy.q)
    || !usableHindi(copy.explanation)
    || copy.options.length !== question.options.length
    || copy.options.some(option => !usableHindi(option))
  ) return question
  return {
    ...question,
    q: copy.q,
    options: copy.options,
    explanation: copy.explanation,
    ref: question.hindi?.ref ?? question.ref,
  }
}

export function articleHasHindiCopy(article: Article) {
  return getArticleCopy(article, 'hi').language === 'hi'
}

export const CATEGORY_LABEL_HI: Record<Article['category'], string> = {
  Polity: 'राजव्यवस्था',
  Economy: 'अर्थव्यवस्था',
  'International Relations': 'अंतरराष्ट्रीय संबंध',
  Environment: 'पर्यावरण',
  'Science and Tech': 'विज्ञान एवं प्रौद्योगिकी',
  Governance: 'शासन व्यवस्था',
  'Social Issues': 'सामाजिक मुद्दे',
  Security: 'सुरक्षा',
  Ethics: 'नीतिशास्त्र',
  Schemes: 'योजनाएँ',
  'Reports and Indices': 'रिपोर्ट एवं सूचकांक',
}

export function categoryLabel(category: Article['category'], language: ReadingLanguage) {
  return language === 'hi' ? CATEGORY_LABEL_HI[category] : category
}
