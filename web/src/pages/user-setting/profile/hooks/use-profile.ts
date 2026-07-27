// src/hooks/useProfile.ts
import { DEFAULT_TIMEZONE } from '@/constants/setting';
import {
  useFetchUserInfo,
  useSaveSetting,
} from '@/hooks/use-user-setting-request';
import { TimezoneList } from '@/pages/user-setting/constants';
import { rsaPsw } from '@/utils';
import { isValidPassword } from '@/utils/password';
import { useCallback, useEffect, useState } from 'react';

interface ProfileData {
  userName: string;
  timeZone: string;
  avatar: string;
  email: string;
  password: string;
  hasPassword: boolean;
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
    password: '',
    hasPassword: false,
  });
  const [savedPassword, setSavedPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);

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
      password: userInfo.password_plain || '',
      hasPassword: Boolean(userInfo.has_password),
    };
    setProfile(profile);
    setSavedPassword(profile.password);
    setPasswordError(false);
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

  const handlePasswordChange = (password: string) => {
    setProfile((prev) => ({ ...prev, password }));
    if (isValidPassword(password)) {
      setPasswordError(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!isValidPassword(profile.password)) {
      setPasswordError(true);
      return;
    }

    const payload: { password?: string; new_password: string } = {
      new_password: rsaPsw(profile.password) as string,
    };
    if (profile.hasPassword) {
      payload.password = rsaPsw(savedPassword) as string;
    }

    const result = await saveSetting(payload);
    if (result === 0) {
      setSavedPassword(profile.password);
      setProfile((prev) => ({ ...prev, hasPassword: true }));
    }
  };

  return {
    profile,
    submitLoading: submitLoading,
    isEditing,
    editType,
    editForm,
    passwordError,
    handleEditClick,
    handleCancel,
    handleSave,
    handleAvatarUpload,
    handlePasswordChange,
    handlePasswordSave,
  };
};
