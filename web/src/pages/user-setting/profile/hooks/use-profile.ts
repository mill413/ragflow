import { DEFAULT_TIMEZONE } from '@/constants/setting';
import {
  useFetchUserInfo,
  useSaveSetting,
} from '@/hooks/use-user-setting-request';
import { TimezoneList } from '@/pages/user-setting/constants';
import { useCallback, useEffect, useState } from 'react';

interface ProfileData {
  userName: string;
  timeZone: string;
  avatar: string;
  email: string;
}

export const EditType = {
  editName: 'editName',
  editTimeZone: 'editTimeZone',
} as const;

export type IEditType = keyof typeof EditType;

export const modalTitle = {
  [EditType.editName]: 'Edit Name',
  [EditType.editTimeZone]: 'Edit Time Zone',
} as const;

const normalizeTimezone = (tz: string | undefined): string => {
  if (!tz) return '';
  // Support both backend format "UTC+8\tAsia/Shanghai" and frontend format "GMT+08:00 Asia/Shanghai"
  const parts = tz.split(/\t|\s+/);
  const ianaName = parts.length > 1 ? parts[parts.length - 1] : tz;
  return TimezoneList.find((item) => item.id === ianaName)?.name ?? '';
};

export const useProfile = () => {
  const { data: userInfo } = useFetchUserInfo();
  const [profile, setProfile] = useState<ProfileData>({
    userName: '',
    avatar: '',
    timeZone: '',
    email: '',
  });

  const [editType, setEditType] = useState<IEditType>(EditType.editName);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ProfileData>>({});
  const {
    saveSetting,
    loading: submitLoading,
    data: saveSettingData,
  } = useSaveSetting();

  useEffect(() => {
    const profile = {
      userName: userInfo.nickname,
      timeZone: normalizeTimezone(userInfo.timezone) || DEFAULT_TIMEZONE?.name,
      avatar: userInfo.avatar || '',
      email: userInfo.email,
    };
    setProfile(profile);
  }, [userInfo, setProfile]);

  useEffect(() => {
    if (saveSettingData === 0) {
      setIsEditing(false);
      setEditForm({});
    }
  }, [saveSettingData]);
  const onSubmit = (newProfile: ProfileData) => {
    const payload: Partial<{
      nickname: string;
      avatar: string;
      timezone: string;
    }> = {
      nickname: newProfile.userName,
      avatar: newProfile.avatar,
      timezone: newProfile.timeZone,
    };

    if (editType === EditType.editName && payload.nickname) {
      saveSetting({ nickname: payload.nickname });
      setProfile(newProfile);
    }
    if (editType === EditType.editTimeZone && payload.timezone) {
      saveSetting({ timezone: payload.timezone });
      setProfile(newProfile);
    }
  };

  const handleEditClick = useCallback(
    (type: IEditType) => {
      setEditForm(profile);
      setEditType(type);
      setIsEditing(true);
    },
    [profile],
  );

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditForm({});
  }, []);

  const handleSave = (data: ProfileData) => {
    const newProfile = { ...profile, ...data };

    onSubmit(newProfile);
  };

  const handleAvatarUpload = (avatar: string) => {
    setProfile((prev) => ({ ...prev, avatar }));
    saveSetting({ avatar });
  };

  return {
    profile,
    setProfile,
    submitLoading: submitLoading,
    isEditing,
    editType,
    editForm,
    handleEditClick,
    handleCancel,
    handleSave,
    handleAvatarUpload,
  };
};
