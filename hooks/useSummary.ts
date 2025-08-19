import { useState } from 'react';

interface UseSummaryReturn {
  generateSummary: (text: string) => Promise<string>;
  isGeneratingSummary: boolean;
  error: string | null;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function useSummary(): UseSummaryReturn {
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async (text: string): Promise<string> => {
    try {
      setIsGeneratingSummary(true);
      setError(null);
      console.log('Generating summary for text:', text);

      const messages: Message[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates concise, clear summaries. Summarize the following text in 2-3 sentences, capturing the main points and key information.',
        },
        {
          role: 'user',
          content: `Please summarize this text:\n\n${text}`,
        },
      ];

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPEN_ROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'openai/chatgpt-4o-latest', // or 'gpt-4' if you have access
          messages: messages,
          max_tokens: 150, // Limit response length for summaries
          temperature: 0.3, // Lower temperature for more focused summaries
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Summary API error:', errorText);
        throw new Error(`Summary generation failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Summary generated successfully');
      
      setIsGeneratingSummary(false);
      // Correct way to access the response content
      return data.choices[0]?.message?.content || 'No summary generated';
    } catch (err) {
      console.error('Summary generation error:', err);
      setError(err instanceof Error ? err.message : 'Summary generation failed');
      setIsGeneratingSummary(false);
      return 'Failed to generate summary. Please try again.';
    }
  };

  return {
    generateSummary,
    isGeneratingSummary,
    error,
  };
}