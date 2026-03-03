// Main Navigator
// Navigation for authenticated users

import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import TabNavigator from './TabNavigator'
import { OnboardingScreen } from '../screens/home'

// Profile screens
import {
  ProfileScreen,
  UserProfileScreen,
  UserListScreen,
  EditQuipScreen,
} from '../screens/profile'
import { AddFriendsScreen } from '../screens/auth'

// Group screens
import {
  MyGroupsScreen,
  GroupDetailScreen,
  CreateGroupScreen,
  CreatePostScreen,
  PostDetailScreen,
  EditGroupScreen,
  EditPostScreen,
  InviteMemberScreen,
  GroupMembersScreen,
} from '../screens/groups'

// Message screens
import { ConversationListScreen, ChatScreen } from '../screens/messages'

// Everyone screens
import {
  ActiveUsersScreen,
  CyberLoungeCreateScreen,
  CyberLoungeDetailScreen,
  CyberLoungeInviteScreen,
  EventsLandingScreen,
  EventCreateScreen,
  EventDetailScreen,
  EventEditScreen,
  MutualAidLandingScreen,
  MutualAidCategoryScreen,
  MutualAidCreateScreen,
  MutualAidPostScreen,
  VettedMemberScreen,
  BarterMarketLandingScreen,
  BarterMarketCreateScreen,
  BarterMarketPostScreen,
  ConfluenceLandingScreen,
  ConfluenceAddPostScreen,
} from '../screens/everyone'

const Stack = createNativeStackNavigator()

const MainNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {/* Main Tabs - This should be your initial route */}
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />

      {/* Profile Stack */}
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="EditQuip" component={EditQuipScreen} />
      <Stack.Screen name="FindFriends" component={AddFriendsScreen} />
      <Stack.Screen
        name="FollowingUsers"
        component={UserListScreen}
        initialParams={{ type: 'following' }}
      />
      <Stack.Screen
        name="Followers"
        component={UserListScreen}
        initialParams={{ type: 'followers' }}
      />
      <Stack.Screen
        name="HiddenUsers"
        component={UserListScreen}
        initialParams={{ type: 'hidden' }}
      />
      <Stack.Screen
        name="BlockedUsers"
        component={UserListScreen}
        initialParams={{ type: 'blocked' }}
      />

      {/* Groups Stack */}
      <Stack.Screen name="MyGroups" component={MyGroupsScreen} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} />
      <Stack.Screen name="PostDetail" component={PostDetailScreen} />
      <Stack.Screen name="EditGroup" component={EditGroupScreen} />
      <Stack.Screen name="EditPost" component={EditPostScreen} />
      <Stack.Screen name="InviteMember" component={InviteMemberScreen} />
      <Stack.Screen name="GroupMembers" component={GroupMembersScreen} />

      {/* Messages Stack */}
      <Stack.Screen name="Messages" component={ConversationListScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />

      {/* Everyone Stack */}
      <Stack.Screen name="ActiveUsers" component={ActiveUsersScreen} />

      {/* Cyber Lounge */}
      <Stack.Screen name="CyberLoungeCreate" component={CyberLoungeCreateScreen} />
      <Stack.Screen name="CyberLoungeDetail" component={CyberLoungeDetailScreen} />
      <Stack.Screen name="CyberLoungeInvite" component={CyberLoungeInviteScreen} />

      {/* Events */}
      <Stack.Screen name="EventsLanding" component={EventsLandingScreen} />
      <Stack.Screen name="EventCreate" component={EventCreateScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="EventEdit" component={EventEditScreen} />

      {/* Mutual Aid */}
      <Stack.Screen name="MutualAidLanding" component={MutualAidLandingScreen} />
      <Stack.Screen name="MutualAidCategory" component={MutualAidCategoryScreen} />
      <Stack.Screen name="MutualAidCreate" component={MutualAidCreateScreen} />
      <Stack.Screen name="MutualAidPost" component={MutualAidPostScreen} />
      <Stack.Screen name="VettedMembers" component={VettedMemberScreen} />

      {/* Barter Market */}
      <Stack.Screen name="BarterMarketLanding" component={BarterMarketLandingScreen} />
      <Stack.Screen name="BarterMarketCreate" component={BarterMarketCreateScreen} />
      <Stack.Screen name="BarterMarketPost" component={BarterMarketPostScreen} />

      {/* Confluence */}
      <Stack.Screen name="ConfluenceLanding" component={ConfluenceLandingScreen} />
      <Stack.Screen name="ConfluenceAddPost" component={ConfluenceAddPostScreen} />
    </Stack.Navigator>
  )
}

export default MainNavigator
