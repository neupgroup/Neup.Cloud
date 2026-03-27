'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getCurrentIntelligenceAccountId } from '@/lib/intelligence/account';
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
} from '@/lib/intelligence/store';

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

  try {
    await createIntelligenceAccessRecord({
      accessIdentifier: generatedAccessId,
      accountId,
      tokenHash: hashAccessToken(generatedToken),
      primaryModelId: input.primaryModelId,
      fallbackModelId: input.fallbackModelId,
      primaryAccessKey: input.primaryAccessKey,
      fallbackAccessKey: input.fallbackAccessKey,
      maxTokens: input.maxTokens,
      defPrompt: input.defPrompt,
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
    await updateIntelligenceAccessRecord({
      accessId,
      accountId,
      primaryModelId: input.primaryModelId,
      fallbackModelId: input.fallbackModelId,
      primaryAccessKey: input.primaryAccessKey,
      fallbackAccessKey: input.fallbackAccessKey,
      maxTokens: input.maxTokens,
      defPrompt: input.defPrompt,
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
