
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
    // Even if the email doesn't exist, Firebase's sendPasswordResetEmail resolves successfully
    // to prevent email enumeration. We return a generic success message to maintain this security.
    // The user will only receive an email if their account exists.
    return {
      success: true,
      message: 'If an account exists for this email, a password reset link has been sent. Please check your inbox.',
    };
  } catch (error: any) {
    console.error('Error sending password reset email:', error.code, error.message);

    let userMessage = 'An unexpected error occurred. Please try again later.';

    // This client-side error handling is for input validation, not for checking if the user exists.
    if (error.code === 'auth/invalid-email') {
      userMessage = 'The email address you entered is not valid.';
    }

    return { success: false, message: userMessage };
  }
}
