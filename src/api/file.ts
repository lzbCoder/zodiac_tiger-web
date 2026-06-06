import api from './index'

export function getFileList(params: {
  page?: number
  page_size?: number
  file_type?: string
  keyword?: string
}) {
  return api.get('/file/list', { params })
}

export function getFileTypes() {
  return api.get('/file/types')
}

export function getFileDownloadUrl(fileId: number) {
  return `/api/file/download/${fileId}`
}

export function deleteFile(fileId: number) {
  return api.delete(`/file/delete/${fileId}`)
}
