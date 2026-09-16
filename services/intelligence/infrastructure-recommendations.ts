'use server';

/**
 * @fileOverview AI-powered infrastructure recommendations flow.
 *
 * - getInfrastructureRecommendations - A function that returns infrastructure recommendations based on app requirements.
 * - InfrastructureRecommendationsInput - The input type for the getInfrastructureRecommendations function.
 * - InfrastructureRecommendationsOutput - The return type for the getInfrastructureRecommendations function.
 */

import {ai} from '@/services/intelligence/genkit';
import {z} from 'genkit';

const InfrastructureRecommendationsInputSchema = z.object({
  appType: z
    .string()
    .describe("The type of application (e.g., 'Node', 'Python', 'PHP', 'Docker')."),
  expectedTraffic: z
    .string()
    .describe('The expected traffic volume (e.g., low, medium, high).'),
  storageRequirements: z
    .string()
    .describe('The storage requirements in GB (e.g., 10GB, 50GB, 100GB).'),
  additionalRequirements: z
    .string()
    .optional()
    .describe('Any additional requirements or preferences (e.g., specific region, database type).'),
});
export type InfrastructureRecommendationsInput = z.infer<
  typeof InfrastructureRecommendationsInputSchema
>;

const InfrastructureRecommendationsOutputSchema = z.object({
  recommendations: z.array(
    z.object({
      provider: z.string().describe('The VPS provider (e.g., DigitalOcean, AWS, Google Cloud).'),
      instanceType: z
        .string()
        .describe('The recommended VPS instance type (e.g., Basic, Standard, Premium).'),
      cpu: z.string().describe('The number of CPUs for the VPS instance.'),
      ram: z.string().describe('The amount of RAM in GB for the VPS instance.'),
      storage: z.string().describe('The amount of storage in GB for the VPS instance.'),
      price: z
        .string()
        .describe('The estimated monthly price for the recommended VPS instance.'),
      dealLink: z.string().describe('Link to the deal for the recommended VPS instance.'),
      reason: z
        .string()
        .describe('Explanation of why this VPS configuration is recommended.'),
    })
  ),
});
export type InfrastructureRecommendationsOutput = z.infer<
  typeof InfrastructureRecommendationsOutputSchema
>;

export async function getInfrastructureRecommendations(
  input: InfrastructureRecommendationsInput
): Promise<InfrastructureRecommendationsOutput> {
  return infrastructureRecommendationsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'infrastructureRecommendationsPrompt',
  input: {schema: InfrastructureRecommendationsInputSchema},
  output: {schema: InfrastructureRecommendationsOutputSchema},
  prompt: `You are an AI assistant that provides infrastructure recommendations for deploying applications on VPS. Based on the application requirements, provide a list of VPS options with details about the provider, instance type, CPU, RAM, storage, price, and a deal link if available.

Application Type: {{{appType}}}
Expected Traffic: {{{expectedTraffic}}}
Storage Requirements: {{{storageRequirements}}}
Additional Requirements: {{{additionalRequirements}}}

Provide a JSON array of recommendations, explaining why each VPS configuration is recommended based on the application requirements. Include at least 3 recommendations with varying instance types and providers.
`,
});

const infrastructureRecommendationsFlow = ai.defineFlow(
  {
    name: 'infrastructureRecommendationsFlow',
    inputSchema: InfrastructureRecommendationsInputSchema,
    outputSchema: InfrastructureRecommendationsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
