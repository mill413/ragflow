import i18n from '@/locales/config';

type ResourceDescriptor = {
  resource_type?: string;
  resource_id?: string;
  resource_name?: string;
  target_resource_id?: string;
};

type ResourceConflictPayload = {
  code?: number;
  data?: {
    reason?: string;
    targets?: ResourceDescriptor[];
    references?: ResourceDescriptor[];
  };
};

const resourceTypeLabel = (resourceType = '') => {
  const translationKey = resourceType.replace(/_([a-z])/g, (_, character) =>
    character.toUpperCase(),
  );
  return String(
    i18n.t(`message.resourceTypes.${translationKey}`, {
      defaultValue: resourceType || i18n.t('message.unknownResource'),
    }),
  );
};

const resourceLabel = (resource: ResourceDescriptor) => {
  const name = resource.resource_name || resource.resource_id || '';
  return `${resourceTypeLabel(resource.resource_type)}「${name}」`;
};

export const formatResourceReferenceConflict = (
  payload: ResourceConflictPayload,
): { title: string; description: string } | undefined => {
  if (
    payload.code !== 409 ||
    payload.data?.reason !== 'resource_in_use' ||
    !payload.data.references?.length
  ) {
    return undefined;
  }

  const targets = payload.data.targets ?? [];
  const references = payload.data.references;
  const lines = targets.flatMap((target) => {
    const targetReferences = references.filter(
      (reference) => reference.target_resource_id === target.resource_id,
    );
    return [
      String(
        i18n.t('message.resourceReferenceTarget', {
          resource: resourceLabel(target),
        }),
      ),
      ...targetReferences.map((reference) => `• ${resourceLabel(reference)}`),
    ];
  });

  return {
    title: String(i18n.t('message.resourceInUse')),
    description: lines.join('\n'),
  };
};
