import { GoogleGenAI } from '@google/genai';

export interface TranslationOptions {
  tone?: 'neutral' | 'formal' | 'informal' | 'professional' | 'creative';
  format?: 'text' | 'markdown' | 'bullet_points';
  mode?: 'literal' | 'natural';
  offlineMode?: boolean;
  highPrecisionOCR?: boolean;
  enhanceImage?: boolean;
  ocrSharpen?: boolean;
  ocrContrast?: number; // 0 to 100
  voiceConfig?: {
    continuous: boolean;
    sensitivity: number; // 0-100
    model: 'standard' | 'enhanced';
  };
}

export async function translateContent(
  text: string,
  sourceLang: string,
  targetLang: string,
  fileData?: { mimeType: string; data: string; name: string } | null,
  options?: TranslationOptions
): Promise<string> {
  if (!text.trim() && !fileData) return '';

  const toneInstruction = options?.tone && options.tone !== 'neutral' 
    ? `Use a ${options.tone} tone for the translation.` 
    : 'Maintain the original tone and intent as closely as possible.';

  const formatInstruction = options?.format === 'bullet_points'
    ? 'Format the output as a list of bullet points.'
    : options?.format === 'markdown'
    ? 'Use Markdown formatting for the output.'
    : 'Maintain original formatting as closely as possible.';

  const modeInstruction = options?.mode === 'literal'
    ? 'Produce a high-accuracy literal translation. Stay as close to the original wording as possible while remaining grammatically correct.'
    : 'Produce a natural, human-like localization. Use idiomatic phrasing, adapt cultural references, and ensure it sounds like a native speaker of the target language wrote it from scratch.';

  let promptText = `Directives for translation:
- Translate the content from ${sourceLang} to ${targetLang}.
- Translation Strategy: ${modeInstruction}
- Context: ${toneInstruction}
- Layout & Structure: ${formatInstruction} IMPORTANT: Maintain the exact structural layout of the source. If the input is structured data (like a table, list, or form), preserve the mapping exactly.

If the source language is undefined or auto-detect, please auto-detect it first.
Return ONLY the translated text. Do not provide meta-comments or explanations.
IMPORTANT: Do NOT use markdown bolding (**) or asterisks in your output.`;

  if (text.trim()) {
    promptText += `\n\nText to translate:\n${text}`;
  }

  if (fileData) {
    const isHighPrecision = options?.highPrecisionOCR ?? true;
    promptText += `\n\n[OCR & Extraction Directive]:
The attached file is an image or document that may contain ${isHighPrecision ? 'very low-resolution, significantly skewed, or complex font' : 'low-resolution, skewed, or varied font'} text. 
1. Perform ${isHighPrecision ? 'INTENSE, high-fidelity' : 'high-precision'} Optical Character Recognition (OCR).
2. ${isHighPrecision ? 'Aggressively detect' : 'Carefully detect'} and correct for text orientation, skew, and distortion.
3. Extract ALL text content precisely, preserving the logical grouping and structural layout.
4. Translate the extracted text accurately while maintaining the identified context.`;
  }

  const contents: any[] = [{
    role: 'user',
    parts: [{ text: promptText }]
  }];

  if (fileData) {
    contents[0].parts.push({
      inlineData: {
        data: fileData.data,
        mimeType: fileData.mimeType
      }
    });
  }

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-3-flash-preview',
        contents,
        config: {
          temperature: 0.1,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.details || errorData.error || 'Server error');
    }

    const data = await response.json();
    return data.text || '';
  } catch (error: any) {
    console.error('Translation error:', error);
    throw new Error(error.message || 'Failed to translate content. Please confirm file size is under 20MB and try again.');
  }
}
