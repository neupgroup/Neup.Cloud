'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getCurrentIntelligenceAccountId } from '@/core/ai/files/intelligence/account';
import {
  createAccessTokenRecord,
  createIntelligenceAccessRecord,
  createIntelligenceModelRecord,
  deleteIntelligenceAccessRecord,
  deleteIntelligenceModelRecord,
  generateAccessIdentifier,
  generateAccessToken,
  getIntelligenceAccessById,
  hashAccessToken,
  parseAccessFormData,
  parseAccessIdFormData,
  parseModelIdFormData,
  parseModelFormData,
  parseRechargeFormData,
  parseTokenFormData,
  rechargeIntelligenceAccessBalance,
  updateIntelligenceModelRecord,
  updateIntelligenceAccessRecord,
} from '@/core/ai/files/intelligence/store';

export async function createAccessTokenAction(formData: FormData) {
  const accountId = await getCurrentIntelligenceAccountId();
  const input = parseTokenFormData(formData);
  await createAccessTokenRecord({
    accountId,
    name: input.name,
    key: input.key,
  });
  revalidatePath('/intelligence/tokens');
  revalidatePath('/intelligence/access');
  revalidatePath('/intelligence/access/add');
  redirect('/intelligence/tokens');
}

export async function createIntelligenceModelAction(formData: FormData) {
  const input = parseModelFormData(formData);

  await createIntelligenceModelRecord(input);

  revalidatePath('/intelligence/models');
  revalidatePath('/intelligence/models/add');
  revalidatePath('/intelligence/access');
  revalidatePath('/intelligence/access/add');
  redirect('/intelligence/models');
}

export interface CreateIntelligenceAccessActionState {
  error: string | null;
  generatedAccessId: string | null;
  generatedToken: string | null;
}

export interface UpdateIntelligenceAccessActionState {
  error: string | null;
  success: string | null;
}

export interface UpdateIntelligenceModelActionState {
  error: string | null;
  success: string | null;
}

export async function createIntelligenceAccessAction(
  _prevState: CreateIntelligenceAccessActionState,
  formData: FormData
): Promise<CreateIntelligenceAccessActionState> {
  const accountId = await getCurrentIntelligenceAccountId();
  const input = parseAccessFormData(formData);
  const generatedAccessId = generateAccessIdentifier();
  const generatedToken = generateAccessToken();
  const tokenHash = hashAccessToken(generatedToken);

  try {
    // Build details based on access type
    let details: unknown = [];

    if (input.accessType === 'open') {
      details = [];
    } else if (input.accessType === 'hybrid') {
      // Format: ["provider/model", "provider/model", ...]
      const modelDetails: string[] = [];
      if (input.primaryModelId) {
        modelDetails.push(`provider/model`); // Will be replaced with actual values
      }
      if (input.fallbackModelId) {
        modelDetails.push(`provider/model`); // Will be replaced with actual values
      }
      details = modelDetails.length > 0 ? modelDetails : [];
    } else if (input.accessType === 'closed') {
      // Format: ["prompt", "provider/model/enc(key)/tokenId", ...]
      const modelDetails: string[] = [];
      if (input.prompt) {
        modelDetails.push(input.prompt);
      }
      if (input.primaryAccessKey) {
        // Format: provider/model/enc(key)/tokenId
        // For now, just add placeholder
        modelDetails.push(`openai/gpt-4/enc(key)/${input.primaryAccessKey}`);
      }
      if (input.fallbackAccessKey) {
        modelDetails.push(`openai/gpt-4/enc(key)/${input.fallbackAccessKey}`);
      }
      details = modelDetails.length > 0 ? modelDetails : [];
    }

    await createIntelligenceAccessRecord({
      accessIdentifier: generatedAccessId,
      accountId,
      tokenHash,
      status: input.status,
      accessType: input.accessType,
      maxTokens: input.maxTokens,
      details,
    });

    revalidatePath('/intelligence/access');
    revalidatePath('/intelligence/access/add');
    revalidatePath('/intelligence/logs');

    return {
      error: null,
      generatedAccessId,
      generatedToken,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to create access',
      generatedAccessId: null,
      generatedToken: null,
    };
  }
}

export async function rechargeIntelligenceBalanceAction(formData: FormData) {
  const accountId = await getCurrentIntelligenceAccountId();
  const input = parseRechargeFormData(formData);
  await rechargeIntelligenceAccessBalance({
    ...input,
    accountId,
  });
  revalidatePath('/intelligence/access');
  revalidatePath('/intelligence/logs');
  revalidatePath('/intelligence/logs/recharge');
  redirect('/intelligence/logs');
}

export async function updateIntelligenceAccessAction(
  _prevState: UpdateIntelligenceAccessActionState,
  formData: FormData
): Promise<UpdateIntelligenceAccessActionState> {
  const accountId = await getCurrentIntelligenceAccountId();
  const accessId = parseAccessIdFormData(formData);
  const input = parseAccessFormData(formData);
  const existingAccess = await getIntelligenceAccessById(accountId, accessId);

  if (!existingAccess) {
    return {
      error: 'Access record not found',
      success: null,
    };
  }

  try {
    // Re-encrypt any sensitive values with the new access key if provided
    // For now, use existing access key (user must pass current access key to edit)

    let details: unknown = [];

    if (input.accessType === 'open') {
      details = [];
    } else if (input.accessType === 'hybrid') {
      const modelDetails: string[] = [];
      if (input.primaryModelId) {
        modelDetails.push(`provider/model`);
      }
      if (input.fallbackModelId) {
        modelDetails.push(`provider/model`);
      }
      details = modelDetails.length > 0 ? modelDetails : [];
    } else if (input.accessType === 'closed') {
      const modelDetails: string[] = [];
      if (input.prompt) {
        modelDetails.push(input.prompt);
      }
      if (input.primaryAccessKey) {
        modelDetails.push(`openai/gpt-4/enc(key)/${input.primaryAccessKey}`);
      }
      if (input.fallbackAccessKey) {
        modelDetails.push(`openai/gpt-4/enc(key)/${input.fallbackAccessKey}`);
      }
      details = modelDetails.length > 0 ? modelDetails : [];
    }

    await updateIntelligenceAccessRecord({
      accessId,
      accountId,
      status: input.status,
      accessType: input.accessType,
      maxTokens: input.maxTokens,
      details,
    });

    revalidatePath('/intelligence/access');
    revalidatePath(`/intelligence/access/${accessId}`);
    revalidatePath('/intelligence/logs');

    return {
      error: null,
      success: 'Access updated successfully.',
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to update access',
      success: null,
    };
  }
}

export async function deleteIntelligenceAccessAction(formData: FormData) {
  const accountId = await getCurrentIntelligenceAccountId();
  const accessId = parseAccessIdFormData(formData);

  await deleteIntelligenceAccessRecord({
    accessId,
    accountId,
  });

  revalidatePath('/intelligence/access');
  revalidatePath(`/intelligence/access/${accessId}`);
  revalidatePath('/intelligence/logs');
  redirect('/intelligence/access');
}

export async function updateIntelligenceModelAction(
  _prevState: UpdateIntelligenceModelActionState,
  formData: FormData
): Promise<UpdateIntelligenceModelActionState> {
  const modelId = parseModelIdFormData(formData);
  const input = parseModelFormData(formData);

  try {
    await updateIntelligenceModelRecord({
      modelId,
      ...input,
    });

    revalidatePath('/intelligence/models');
    revalidatePath(`/intelligence/models/${modelId}`);
    revalidatePath('/intelligence/models/add');
    revalidatePath('/intelligence/access');
    revalidatePath('/intelligence/access/add');

    return {
      error: null,
      success: 'Model updated successfully.',
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to update model',
      success: null,
    };
  }
}

export async function deleteIntelligenceModelAction(formData: FormData) {
  const modelId = parseModelIdFormData(formData);

  await deleteIntelligenceModelRecord({
    modelId,
  });

  revalidatePath('/intelligence/models');
  revalidatePath(`/intelligence/models/${modelId}`);
  revalidatePath('/intelligence/access');
  revalidatePath('/intelligence/access/add');
  redirect('/intelligence/models');
}
