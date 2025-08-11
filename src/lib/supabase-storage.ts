import { supabase } from './supabase'

export interface UploadedFile {
  name: string
  url: string
  size: number
  type: string
}

export const storageHelpers = {
  // Upload a single file to Supabase storage
  async uploadFile(file: File, ticketId: string): Promise<UploadedFile | null> {
    try {
      // Create a unique filename to avoid conflicts
      const timestamp = Date.now()
      const fileExtension = file.name.split('.').pop()
      const fileName = `${ticketId}/${timestamp}-${file.name}`
      
      // Upload file to Supabase storage
      const { data, error } = await supabase.storage
        .from('tickets')
        .upload(`supporting-files/${fileName}`, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Error uploading file:', error)
        return null
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('tickets')
        .getPublicUrl(`supporting-files/${fileName}`)

      return {
        name: file.name,
        url: urlData.publicUrl,
        size: file.size,
        type: file.type
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      return null
    }
  },

  // Upload multiple files
  async uploadFiles(files: File[], ticketId: string): Promise<UploadedFile[]> {
    const uploadedFiles: UploadedFile[] = []
    
    for (const file of files) {
      const uploadedFile = await this.uploadFile(file, ticketId)
      if (uploadedFile) {
        uploadedFiles.push(uploadedFile)
      }
    }
    
    return uploadedFiles
  },

  // Delete a file from Supabase storage
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const { error } = await supabase.storage
        .from('tickets')
        .remove([filePath])

      if (error) {
        console.error('Error deleting file:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error deleting file:', error)
      return false
    }
  },

  // Get file URL
  getFileUrl(filePath: string): string {
    const { data } = supabase.storage
      .from('tickets')
      .getPublicUrl(filePath)
    
    return data.publicUrl
  }
}
