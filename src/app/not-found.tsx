'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { 
  Home, 
  ArrowLeft, 
  Search, 
  HelpCircle, 
  FileText, 
  Bell, 
  Clock 
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex flex-col items-center justify-center p-8">
      {/* Hero Section */}
      <div className="text-center space-y-8 max-w-4xl mx-auto">
        {/* GIF */}
        <div className="mx-auto  flex items-center justify-center">
          <Image 
            src="/404-notfound.gif" 
            alt="404 Not Found" 
            width={256}
            height={256}
            className="w-full h-full object-contain"
          />
        </div>
        
        {/* Main Content */}
        <div className="space-y-6">
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Oops! The page you're looking for seems to have vanished into the digital void. 
            Don't worry, even the best explorers sometimes take a wrong turn.
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button 
            onClick={() => router.back()}
            variant="outline"
            size="lg"
            className="flex items-center gap-2 px-8 py-3"
          >
            <ArrowLeft className="h-5 w-5" />
            Go Back
          </Button>
          <Button 
            asChild
            size="lg"
            className="flex items-center gap-2 px-8 py-3"
          >
            <Link href="/dashboard">
              <Home className="h-5 w-5" />
              Go Home
            </Link>
          </Button>
        </div>
      </div>
      
      {/* Quick Links */}
      <div className="mt-16 w-full max-w-4xl">
        <h3 className="text-2xl font-semibold text-center mb-8">Quick Navigation</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button variant="outline" size="lg" asChild className="h-16 flex flex-col gap-2">
            <Link href="/dashboard">
              <Home className="h-6 w-6" />
              <span>Dashboard</span>
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild className="h-16 flex flex-col gap-2">
            <Link href="/forms/my-tickets">
              <FileText className="h-6 w-6" />
              <span>My Tickets</span>
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild className="h-16 flex flex-col gap-2">
            <Link href="/notifications">
              <Bell className="h-6 w-6" />
              <span>Notifications</span>
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild className="h-16 flex flex-col gap-2">
            <Link href="/status/breaks">
              <Clock className="h-6 w-6" />
              <span>Status</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
