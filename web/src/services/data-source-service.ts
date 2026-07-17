import api from '@/utils/api';
import registerServer from '@/utils/register-server';
import request from '@/utils/request';

const { dataSourceSet, dataSourceList } = api;
const methods = {
  dataSourceSet: {
    url: dataSourceSet,
    method: 'post',
  },
  dataSourceList: {
    url: dataSourceList,
    method: 'get',
  },
} as const;
const dataSourceService = registerServer<keyof typeof methods>(
  methods,
  request,
);

export const deleteDataSource = (id: string) =>
  request.delete(api.dataSourceDel(id));

export const dataSourceRebuild = (id: string, data: { kb_id: string }) => {
  return request.post(api.dataSourceRebuild(id), { data });
};

export const dataSourceUpdate = (id: string, data: Record<string, any>) => {
  return request.patch(api.dataSourceUpdate(id), { data });
};

export const getDataSourceLogs = (id: string, params?: any) =>
  request.get(api.dataSourceLogs(id), { params });
export const featchDataSourceDetail = (id: string) =>
  request.get(api.dataSourceDetail(id));

export default dataSourceService;
