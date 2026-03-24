'use server';
/**
 * @fileOverview A Genkit flow for quickly registering new products.
 *
 * - quickProductRegistration - A function that suggests product details for a new product based on its barcode.
 * - QuickProductRegistrationInput - The input type for the quickProductRegistration function.
 * - QuickProductRegistrationOutput - The return type for the quickProductRegistration function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const QuickProductRegistrationInputSchema = z.object({
  barcode: z.string().describe('The EAN-13 barcode of the product.'),
  existingProductNames: z.array(z.string()).optional().describe('A list of existing product names in the inventory to provide context for naming conventions.'),
});
export type QuickProductRegistrationInput = z.infer<typeof QuickProductRegistrationInputSchema>;

const QuickProductRegistrationOutputSchema = z.object({
  suggestedName: z.string().describe('A suggested name for the product based on the barcode.'),
  suggestedPrice: z.number().min(0).describe('A suggested price for the product.'),
  suggestedCategory: z.string().describe('A suggested category for the product (e.g., "Electronics", "Food", "Books", "Household").'),
});
export type QuickProductRegistrationOutput = z.infer<typeof QuickProductRegistrationOutputSchema>;

export async function quickProductRegistration(input: QuickProductRegistrationInput): Promise<QuickProductRegistrationOutput> {
  return quickProductRegistrationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'quickProductRegistrationPrompt',
  input: {schema: QuickProductRegistrationInputSchema},
  output: {schema: QuickProductRegistrationOutputSchema},
  prompt: `You are an AI assistant specialized in point-of-sale systems and inventory management. Your task is to suggest details for a new product based on its EAN-13 barcode.

Based on the provided barcode, suggest a suitable product name, a reasonable price (e.g., 9.99), and a general category.
Consider the barcode as a unique identifier that often encodes information about the product type.
If you have a list of existing product names, try to match the naming style and common categories found in that list.

Barcode: {{{barcode}}}
{{#if existingProductNames}}
Existing Product Names for context:
{{#each existingProductNames}} - {{{this}}}
{{/each}}
{{/if}}

Please provide your suggestions in a JSON object with the fields 'suggestedName', 'suggestedPrice', and 'suggestedCategory'.`,
});

const quickProductRegistrationFlow = ai.defineFlow(
  {
    name: 'quickProductRegistrationFlow',
    inputSchema: QuickProductRegistrationInputSchema,
    outputSchema: QuickProductRegistrationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('Failed to get suggestions for product registration.');
    }
    return output;
  }
);
