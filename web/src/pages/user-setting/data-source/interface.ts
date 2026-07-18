import { RunningStatus } from '@/constants/knowledge';
import { DataSourceKey } from './constant';
import { IWorkspaceResource } from '@/interfaces/database/workspace';

export interface IDataSorceInfo {
  id: DataSourceKey;
  name: string;
  description: string;
  icon: React.ReactNode;
}

export type IDataSource = IDataSourceBase & {
  config: any;
  indexing_start: null | string;
  input_type: string;
  prune_freq: number;
  refresh_freq: number;
  status: string;
  tenant_id: string;
  update_date: string;
  update_time: number;
};

export interface IDataSourceBase extends IWorkspaceResource {
  id: string;
  tenant_id?: string;
  name: string;
  source: DataSourceKey;
  auto_parse?: '0' | '1';
  status?: RunningStatus;
}

export interface IDataSourceLog {
  connector_id: string;
  docs_removed_from_index?: number;
  error_count: number;
  error_msg: string;
  id: string;
  kb_id: string;
  kb_name: string;
  new_docs_indexed: number;
  prune_freq?: number;
  refresh_freq?: number;
  status: RunningStatus;
  task_type?: string;
  time_started?: string | null;
  total_docs_indexed?: number;
  update_date: string;
}

interface IDataSourceInfoItem {
  name: string;
  description: string;
  icon: JSX.Element;
}

export type IDataSourceInfoMap = Record<DataSourceKey, IDataSourceInfoItem>;
