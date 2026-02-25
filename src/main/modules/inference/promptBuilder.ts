const MAX_CORPUS_CHARS = 60000;

export interface PromptBuildInput {
  corpus: string;
  customInfo: string;
  model: string;
  imageBase64: string;
}

export interface PromptBuildResult {
  body: Record<string, unknown>;
  corpusTruncated: boolean;
}

export function buildPrompt(input: PromptBuildInput): PromptBuildResult {
  const { value: corpus, truncated } = truncateCorpus(input.corpus, MAX_CORPUS_CHARS);

  const instruction = [
    'You are a discreet workplace recall assistant.',
    'Answer using the screenshot and provided context only.',
    'Output the shortest useful answer possible: one token, word, or very short phrase.',
    'If uncertain or unsupported by evidence, output exactly: unknown.',
    'Do not add explanation, punctuation, or extra words unless required for meaning.',
    'Match language and terminology style from the context corpus.'
  ].join(' ');

  const contextText = [
    'Context corpus:',
    corpus || '[empty]',
    '',
    'Custom info:',
    input.customInfo || '[none]'
  ].join('\n');

  return {
    corpusTruncated: truncated,
    body: {
      model: input.model,
      temperature: 0.0,
      max_tokens: 32,
      stream: true,
      messages: [
        {
          role: 'system',
          content: instruction
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: contextText
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${input.imageBase64}`
              }
            }
          ]
        }
      ]
    }
  };
}

export function truncateCorpus(corpus: string, maxChars: number): { value: string; truncated: boolean } {
  const trimmed = corpus.trim();
  if (trimmed.length <= maxChars) {
    return {
      value: trimmed,
      truncated: false
    };
  }

  return {
    value: `${trimmed.slice(0, maxChars)}\n[truncated]`,
    truncated: true
  };
}
