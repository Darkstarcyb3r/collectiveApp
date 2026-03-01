// Auth Navigator
// Navigation stack for unauthenticated users

import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import {
  LandingScreen,
  LoginScreen,
  SignUpScreen,
  ForgotPasswordScreen,
  VerifyCodeScreen,
  ResetPasswordScreen,
  EmailVerificationScreen,
  ProfileSetupScreen,
  PasswordResetSuccessScreen,
} from '../screens/auth'

const Stack = createNativeStackNavigator()

const AuthNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Landing"
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
    </Stack.Navigator>
  )
}

export default AuthNavigator
