'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getCurrentIntelligenceAccountId } from '@/core/ai/files/intelligence/account';
import {
  createAccessTokenRecord,
  createIntelligenceAccessRecord,
  createIntelligenceModelRecord,
  decryptValue,
  deleteIntelligenceAccessRecord,
  deleteIntelligenceModelRecord,
  encryptValue,
  generateAccessIdentifier,
  generateAccessToken,
  getAccessTokenById,
  getIntelligenceAccessById,
  getIntelligenceModels,
  hashAccessToken,
  parseAccessFormData,
  parseAccessIdFormData,
  parseModelIdFormData,
  parseModelFormData,
  parseRechargeFormData,
  parseTokenFormData,
  publishIntelligenceAccess,
  rechargeIntelligenceAccessBalance,
  updateIntelligenceAccessRecord,
  updateIntelligenceAccessStatus,
  updateIntelligenceModelRecord,
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
}

export interface UpdateIntelligenceAccessActionState {
  error: string | null;
  success: string | null;
}

export interface PublishIntelligenceAccessActionState {
  error: string | null;
  success: string | null;
  generatedAccessKey: string | null;
}

export interface UpdateIntelligenceAccessStatusActionState {
  error: string | null;
  success: string | null;
}

export interface UpdateIntelligenceAccessConfigActionState {
  error: string | null;
  success: string | null;
}

export interface ResetIntelligenceAccessKeyActionState {
  error: string | null;
  success: string | null;
  generatedAccessKey: string | null;
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
    // Build details array: ["prompt", "provider/model/0/tokenId", "provider/model/0/tokenId", ...]
    const details: string[] = [];

    if (input.accessType === 'open') {
      // Open access: no details
      details.push('');
    } else if (input.accessType === 'hybrid' || input.accessType === 'closed') {
      // Add prompt first for closed access
      if (input.accessType === 'closed' && input.prompt) {
        details.push(input.prompt);
      } else if (input.accessType === 'hybrid') {
        details.push('');
      }

      // Add model blocks with 0 as placeholder for key
      const modelIds = [input.primaryModelId, input.fallbackModelId].filter(Boolean) as number[];
      const tokenIds = [input.primaryAccessKey, input.fallbackAccessKey].filter(Boolean) as number[];

      for (let i = 0; i < modelIds.length; i++) {
        const modelId = modelIds[i];
        const tokenId = tokenIds[i] || 0;

        // Get model info
        const models = await getIntelligenceModels();
        const model = models.find((m) => m.id === modelId);

        if (model) {
          // Format: provider/model/0/tokenId (0 means unpublished)
          details.push(`${model.provider}/${model.model}/0/${tokenId}`);
        }
      }
    }

    const accessId = await createIntelligenceAccessRecord({
      accessIdentifier: generatedAccessId,
      accountId,
      tokenHash,
      status: 'unpublished',
      accessType: input.accessType,
      maxTokens: input.maxTokens,
      details,
    });

    revalidatePath('/intelligence/access');
    revalidatePath('/intelligence/access/add');
    revalidatePath(`/intelligence/access/${accessId}`);
    revalidatePath('/intelligence/logs');

    redirect(`/intelligence/access/${accessId}`);
  } catch (error) {
    if ((error as { digest?: string })?.digest?.includes('NEXT_REDIRECT')) {
      throw error;
    }
    return {
      error: error instanceof Error ? error.message : 'Failed to create access',
      generatedAccessId: null,
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

export async function publishIntelligenceAccessAction(
  _prevState: PublishIntelligenceAccessActionState,
  formData: FormData
): Promise<PublishIntelligenceAccessActionState> {
  const accountId = await getCurrentIntelligenceAccountId();
  const accessId = parseAccessIdFormData(formData);
  const resetKey = formData.get('reset_key') === 'true';
  const previousKey = formData.get('previous_key') as string | null;
  const newAccessKey = formData.get('new_access_key') as string | null;

  try {
    const result = await publishIntelligenceAccess({
      accessId,
      accountId,
      accessKey: newAccessKey || generateAccessToken(),
      resetKey,
      previousKey: previousKey || undefined,
    });

    revalidatePath('/intelligence/access');
    revalidatePath(`/intelligence/access/${accessId}`);
    revalidatePath('/intelligence/logs');

    return {
      error: null,
      success: 'Access published successfully',
      generatedAccessKey: result.newAccessKey,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to publish access',
      success: null,
      generatedAccessKey: null,
    };
  }
}

export async function updateIntelligenceAccessStatusAction(
  _prevState: UpdateIntelligenceAccessStatusActionState,
  formData: FormData
): Promise<UpdateIntelligenceAccessStatusActionState> {
  const accountId = await getCurrentIntelligenceAccountId();
  const accessId = parseAccessIdFormData(formData);
  const status = formData.get('status') as string;

  if (!['dev', 'prod', 'hold'].includes(status)) {
    return {
      error: 'Invalid status value',
      success: null,
    };
  }

  try {
    // Get the current access to verify it's published
    const access = await getIntelligenceAccessById(accountId, accessId);

    if (!access) {
      return {
        error: 'Access record not found',
        success: null,
      };
    }

    if (access.status === 'unpublished') {
      return {
        error: 'Cannot change status of unpublished access. Please publish first.',
        success: null,
      };
    }

    await updateIntelligenceAccessStatus({
      accessId,
      accountId,
      status: status as 'dev' | 'prod' | 'hold',
    });

    revalidatePath('/intelligence/access');
    revalidatePath(`/intelligence/access/${accessId}`);
    revalidatePath('/intelligence/logs');

    return {
      error: null,
      success: 'Status updated successfully',
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to update status',
      success: null,
    };
  }
}

export async function updateIntelligenceAccessConfigAction(
  _prevState: UpdateIntelligenceAccessConfigActionState,
  formData: FormData
): Promise<UpdateIntelligenceAccessConfigActionState> {
  const accountId = await getCurrentIntelligenceAccountId();
  const accessId = parseAccessIdFormData(formData);
  const accessKey = formData.get('access_key') as string | null;
  const prompt = formData.get('prompt') as string | null;
  const maxTokens = formData.get('max_tokens') as string | null;

  if (!accessKey) {
    return {
      error: 'Access key is required to update configuration',
      success: null,
    };
  }

  try {
    // Get the current access
    const access = await getIntelligenceAccessById(accountId, accessId);

    if (!access) {
      return {
        error: 'Access record not found',
        success: null,
      };
    }

    // Verify the access key
    const keyHash = hashAccessToken(accessKey);
    if (keyHash !== access.key_hash) {
      return {
        error: 'Invalid access key',
        success: null,
      };
    }

    // Parse model blocks from form data
    const modelBlocks: string[] = [];
    let index = 0;
    
    while (formData.get(`model_${index}_id`)) {
      const modelId = formData.get(`model_${index}_id`) as string;
      const tokenId = formData.get(`token_${index}_id`) as string;

      if (modelId && modelId !== '') {
        const models = await getIntelligenceModels();
        const model = models.find((m) => m.id === Number(modelId));

        if (model) {
          if (tokenId && tokenId !== '0' && tokenId !== '') {
            // Get the API key and encrypt it
            const token = await getAccessTokenById(accountId, Number(tokenId));
            if (token) {
              const encryptedKey = encryptValue(token.key, accessKey);
              modelBlocks.push(`${model.provider}/${model.model}/${encryptedKey}/${tokenId}`);
            } else {
              modelBlocks.push(`${model.provider}/${model.model}/0/${tokenId}`);
            }
          } else {
            modelBlocks.push(`${model.provider}/${model.model}/0/0`);
          }
        }
      }

      index++;
    }

    // Build new details array
    const newDetails: string[] = [];
    
    if (access.type === 'closed' && prompt) {
      newDetails.push(prompt);
    } else if (access.type === 'hybrid') {
      newDetails.push('');
    }

    newDetails.push(...modelBlocks);

    // Update the access record
    await updateIntelligenceAccessRecord({
      accessId,
      accountId,
      status: access.status as 'dev' | 'prod' | 'hold',
      accessType: access.type as 'open' | 'hybrid' | 'closed',
      maxTokens: maxTokens ? parseInt(maxTokens, 10) : null,
      details: JSON.stringify(newDetails),
    });

    revalidatePath('/intelligence/access');
    revalidatePath(`/intelligence/access/${accessId}`);
    revalidatePath('/intelligence/logs');

    return {
      error: null,
      success: 'Configuration updated successfully',
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to update configuration',
      success: null,
    };
  }
}

export async function resetIntelligenceAccessKeyAction(
  _prevState: ResetIntelligenceAccessKeyActionState,
  formData: FormData
): Promise<ResetIntelligenceAccessKeyActionState> {
  const accountId = await getCurrentIntelligenceAccountId();
  const accessId = parseAccessIdFormData(formData);

  try {
    // Get the current access
    const access = await getIntelligenceAccessById(accountId, accessId);

    if (!access) {
      return {
        error: 'Access record not found',
        success: null,
        generatedAccessKey: null,
      };
    }

    if (access.status === 'unpublished') {
      return {
        error: 'Access is already unpublished',
        success: null,
        generatedAccessKey: null,
      };
    }

    // Generate new access key
    const newAccessKey = generateAccessToken();
    const newKeyHash = hashAccessToken(newAccessKey);

    // Parse details array and reset encrypted keys to 0
    const details = Array.isArray(access.details) ? access.details : [];
    const updatedDetails: string[] = [];

    for (const detail of details) {
      if (!detail || detail === '') {
        updatedDetails.push(detail);
        continue;
      }

      // Check if it's a model string (provider/model/encryptedKey/tokenId)
      if (detail.includes('/')) {
        const parts = detail.split('/');
        if (parts.length === 4) {
          const [provider, model, , tokenId] = parts;
          // Reset the encrypted key to 0 (unpublished state)
          updatedDetails.push(`${provider}/${model}/0/${tokenId}`);
        } else {
          updatedDetails.push(detail);
        }
      } else {
        // It's a prompt or other string, keep as is
        updatedDetails.push(detail);
      }
    }

    // Update the access record with new key hash, reset details, and unpublished status
    await updateIntelligenceAccessRecord({
      accessId,
      accountId,
      status: 'unpublished',
      accessType: access.type as 'open' | 'hybrid' | 'closed',
      maxTokens: access.max_tokens,
      details: JSON.stringify(updatedDetails),
      keyHash: newKeyHash,
    });

    revalidatePath('/intelligence/access');
    revalidatePath(`/intelligence/access/${accessId}`);
    revalidatePath('/intelligence/logs');

    return {
      error: null,
      success: 'Access key reset successfully. Status set to unpublished. You will need to publish again with the new key.',
      generatedAccessKey: newAccessKey,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to reset access key',
      success: null,
      generatedAccessKey: null,
    };
  }
}
