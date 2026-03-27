
'use server';
/**
 * @fileOverview A Genkit flow for quickly registering new products.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const QuickProductRegistrationInputSchema = z.object({
  barcode: z.string().describe('The EAN-13 barcode of the product.'),
  existingProductNames: z.array(z.string()).optional().describe('Existing names for context.'),
});
export type QuickProductRegistrationInput = z.infer<typeof QuickProductRegistrationInputSchema>;

const QuickProductRegistrationOutputSchema = z.object({
  suggestedName: z.string().describe('A suggested name.'),
  suggestedPrice: z.number().min(0).describe('A suggested price.'),
  suggestedCategory: z.string().describe('A suggested category.'),
  suggestedIdealStock: z.number().describe('A suggested normal/ideal stock level for this item.'),
  suggestedDistributor: z.string().optional().describe('A suggested distributor or company name for the product.'),
});
export type QuickProductRegistrationOutput = z.infer<typeof QuickProductRegistrationOutputSchema>;

export async function quickProductRegistration(input: QuickProductRegistrationInput): Promise<QuickProductRegistrationOutput> {
  return quickProductRegistrationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'quickProductRegistrationPrompt',
  input: {schema: QuickProductRegistrationInputSchema},
  output: {schema: QuickProductRegistrationOutputSchema},
  prompt: `You are an AI assistant for a POS system. Suggest details for a new product based on its barcode.
Suggest a name, price, category, distributor/company name, and an "ideal stock" level (how many units should normally be in stock).

Barcode: {{{barcode}}}
{{#if existingProductNames}}
Existing context:
{{#each existingProductNames}} - {{{this}}}
{{/each}}
{{/if}}`,
});

const quickProductRegistrationFlow = ai.defineFlow(
  {
    name: 'quickProductRegistrationFlow',
    inputSchema: QuickProductRegistrationInputSchema,
    outputSchema: QuickProductRegistrationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) throw new Error('Failed to get suggestions.');
    return output;
  }
);
