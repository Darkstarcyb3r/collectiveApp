// Auth Navigator
// Navigation stack for unauthenticated users and onboarding

import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '../contexts/AuthContext'
import {
  LandingScreen,
  LoginScreen,
  SignUpScreen,
  ForgotPasswordScreen,
  VerifyCodeScreen,
  ResetPasswordScreen,
  EmailVerificationScreen,
  ProfileSetupScreen,
  AddFriendsScreen,
  PasswordResetSuccessScreen,
} from '../screens/auth'

const Stack = createNativeStackNavigator()

const AuthNavigator = () => {
  const { isProfileSetup, isEmailVerified, isAddFriendsComplete } = useAuth()

  // If profile is set up and email verified but add friends not done, start at AddFriends
  const initialRoute =
    isProfileSetup && isEmailVerified && !isAddFriendsComplete
      ? 'AddFriends'
      : 'Landing'

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="PasswordResetSuccess" component={PasswordResetSuccessScreen} />
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="AddFriends" component={AddFriendsScreen} />
    </Stack.Navigator>
  )
}

export default AuthNavigator
