"use client"

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Camera, Upload, X, CheckCircle, AlertCircle } from 'lucide-react'
import { useUpdateProfile } from '@/hooks/use-profile'

interface ProfilePictureUploadProps {
  currentProfilePicture?: string
  firstName?: string
  lastName?: string
  email?: string
  onUploadSuccess?: (newUrl: string) => void
}

export function ProfilePictureUpload({
  currentProfilePicture,
  firstName,
  lastName,
  email,
  onUploadSuccess
}: ProfilePictureUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { updateProfile } = useUpdateProfile()

  const getInitials = (first?: string, last?: string, email?: string) => {
    const firstTrim = (first || '').trim()
    const lastTrim = (last || '').trim()
    if (firstTrim || lastTrim) {
      const a = firstTrim ? firstTrim[0] : ''
      const b = lastTrim ? lastTrim[0] : ''
      const initials = `${a}${b}` || (firstTrim.slice(0, 2))
      return initials.toUpperCase()
    }
    const mail = (email || '').trim()
    if (mail.includes('@')) {
      const [local, domain] = mail.split('@')
      const a = local?.[0] || ''
      const b = domain?.[0] || ''
      const initials = `${a}${b}`
      return initials ? initials.toUpperCase() : 'SA'
    }
    return 'SA'
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.')
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      setError('File too large. Please upload an image smaller than 5MB.')
      return
    }

    // Create preview URL
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    setError(null)
    setSuccess(false)
  }

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)
    setSuccess(false)

    try {
      // Create form data
      const formData = new FormData()
      formData.append('profilePicture', file)

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 200)

      // Upload file
      const response = await fetch('/api/profile/upload-picture', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result = await response.json()

      if (result.success) {
        setSuccess(true)
        onUploadSuccess?.(result.profilePictureUrl)
        
        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        
        // Clear preview after a delay
        setTimeout(() => {
          setPreviewUrl(null)
          setSuccess(false)
        }, 3000)
      } else {
        throw new Error(result.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      setError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleRemovePicture = async () => {
    try {
      setIsUploading(true)
      setError(null)
      setSuccess(false)

      const response = await fetch('/api/profile/upload-picture', {
        method: 'DELETE',
        credentials: 'include'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Remove failed')
      }

      const result = await response.json()

      if (result.success) {
        onUploadSuccess?.('')
        setPreviewUrl(null)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        throw new Error(result.error || 'Remove failed')
      }
    } catch (error) {
      console.error('Remove error:', error)
      setError(error instanceof Error ? error.message : 'Failed to remove profile picture')
    } finally {
      setIsUploading(false)
    }
  }

  const displayImage = previewUrl || currentProfilePicture

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Profile Picture</CardTitle>
        <CardDescription>
          Upload a profile photo to personalize your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center">
          <div className="relative">
            <Avatar className="w-24 h-24">
              <AvatarImage src={displayImage || undefined} alt="Profile" />
              <AvatarFallback className="text-xl font-semibold">
                {getInitials(firstName, lastName, email)}
              </AvatarFallback>
            </Avatar>
            {isUploading && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <div className="text-white text-xs font-medium">
                  {uploadProgress}%
                </div>
              </div>
            )}
            {success && (
              <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex-1"
            >
              <Camera className="w-4 h-4 mr-2" />
              Choose Photo
            </Button>
            
            {previewUrl && (
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                size="sm"
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
            )}
          </div>

          {currentProfilePicture && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemovePicture}
              disabled={isUploading}
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="w-4 h-4 mr-2" />
              {isUploading ? 'Removing...' : 'Remove Current Picture'}
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>Supported formats: JPEG, PNG, GIF, WebP</p>
          <p>Maximum file size: 5MB</p>
        </div>
      </CardContent>
    </Card>
  )
}
