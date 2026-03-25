/**
 * Extract decision cards from review markdown
 */

export interface DecisionCard {
  decision: string;
  whyItMatters: string;
  optionA: string;
  optionB: string;
  tradeoff: string;
  recommendedDefault: string;
}

export function extractDecisionCards(markdownText: string): DecisionCard[] {
  const cards: DecisionCard[] = [];
  
  // Find all Decision Card sections
  const cardRegex = /### Decision Card \d+\s*\n([\s\S]*?)(?=###|##|$)/g;
  let match;
  
  while ((match = cardRegex.exec(markdownText)) !== null) {
    const cardText = match[1];
    
    const card: DecisionCard = {
      decision: extractField(cardText, 'Decision'),
      whyItMatters: extractField(cardText, 'Why it matters'),
      optionA: extractField(cardText, 'Option A'),
      optionB: extractField(cardText, 'Option B'),
      tradeoff: extractField(cardText, 'Tradeoff'),
      recommendedDefault: extractField(cardText, 'Recommended default if Ben does not answer'),
    };
    
    cards.push(card);
  }
  
  return cards;
}

function extractField(text: string, fieldName: string): string {
  const regex = new RegExp(`-\\s*${fieldName}:\\s*(.+)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}
