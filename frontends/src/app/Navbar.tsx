import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { Button } from "@/components/ui/button";
import { 
  Cog, 
  FileText, 
  Trash2, 
  Home, 
  LogOut 
} from 'lucide-react';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const router = useRouter();
  
  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };
  
  return (
    <nav className="bg-white shadow-sm py-4 px-6 flex justify-between items-center">
      <div className="flex items-center">
        <h1 className="text-xl font-bold mr-10">Yapper</h1>
        
        {currentUser && (
          <div className="flex space-x-2">
            <Button variant="ghost" asChild>
              <Link href="/home">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Link>
            </Button>
            
            <Button variant="ghost" asChild>
              <Link href="/documents">
                <FileText className="mr-2 h-4 w-4" />
                Documents
              </Link>
            </Button>
            
            <Button variant="ghost" asChild>
              <Link href="/settings">
                <Cog className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
            
            <Button variant="ghost" asChild>
              <Link href="/trash">
                <Trash2 className="mr-2 h-4 w-4" />
                Trash
              </Link>
            </Button>
          </div>
        )}
      </div>
      
      <div>
        {currentUser ? (
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        ) : (
          <div className="flex space-x-2">
            <Button variant="outline" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button variant="default" asChild>
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
