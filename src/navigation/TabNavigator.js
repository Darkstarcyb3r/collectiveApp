// Tab Navigator
// Bottom tab navigation with auto-hide custom tab bar
// Tabs: Home (Dashboard), Messages, Profile, Confluences

import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'

// Screens
import { DashboardScreen } from '../screens/home'
import { ConversationListScreen } from '../screens/messages'
import { ConfluenceLandingScreen } from '../screens/everyone'
import { ProfileScreen } from '../screens/profile'

// Custom tab bar
import AutoHideTabBar from '../components/navigation/AutoHideTabBar'

const Tab = createBottomTabNavigator()

const TabNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <AutoHideTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen name="HomeTab" component={DashboardScreen} />
      <Tab.Screen name="ProfileTab" component={ProfileScreen} />
      <Tab.Screen name="MessagesTab" component={ConversationListScreen} />
      <Tab.Screen name="ConfluenceTab" component={ConfluenceLandingScreen} />
    </Tab.Navigator>
  )
}

export default TabNavigator
