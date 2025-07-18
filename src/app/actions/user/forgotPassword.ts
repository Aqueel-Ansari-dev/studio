
'use server';

import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

interface ForgotPasswordResult {
  success: boolean;
  message: string;
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResult> {
  if (!email) {
    return { success: false, message: 'Email address is required.' };
  }

  try {
    await sendPasswordResetEmail(auth, email);
    return {
      success: true,
      message: 'Password reset email sent. Please check your inbox.',
    };
  } catch (error: any) {
    console.error('Error sending password reset email:', error.code, error.message);

    let userMessage = 'An unexpected error occurred. Please try again later.';

    // Provide more user-friendly messages for common Firebase errors
    if (error.code === 'auth/invalid-email') {
      userMessage = 'The email address you entered is not valid.';
    } else if (error.code === 'auth/user-not-found') {
      // For security, you might not want to reveal if an email exists.
      // But for better UX, you can inform the user.
      userMessage = 'No account found with that email address.';
    }

    return { success: false, message: userMessage };
  }
}
