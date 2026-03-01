// TabBarContext - Controls tab bar visibility across the app
// Provides show/hide triggers for scroll-based and timer-based auto-hide
// Usage: wrap with <TabBarProvider>, then useTabBar() in screens

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'

const TabBarContext = createContext()

const IDLE_TIMEOUT = 5000 // 5 seconds of inactivity before fade

export const TabBarProvider = ({ children }) => {
  const [visible, setVisible] = useState(true)
  const [notificationModalRequested, setNotificationModalRequested] = useState(false)
  const idleTimer = useRef(null)

  // Reset the idle timer — shows the bar and starts the countdown
  const resetTimer = useCallback(() => {
    setVisible(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      setVisible(false)
    }, IDLE_TIMEOUT)
  }, [])

  // Called by screens when the user scrolls past 50%
  const hideTabBar = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    setVisible(false)
  }, [])

  // Called by screens when user scrolls back up or taps
  const showTabBar = useCallback(() => {
    resetTimer()
  }, [resetTimer])

  // Activity tab: request notification modal open on DashboardScreen
  const requestNotificationModal = useCallback(() => {
    setNotificationModalRequested(true)
  }, [])

  const clearNotificationModalRequest = useCallback(() => {
    setNotificationModalRequested(false)
  }, [])

  // Start the initial idle timer
  useEffect(() => {
    resetTimer()
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <TabBarContext.Provider
      value={{
        visible,
        showTabBar,
        hideTabBar,
        resetTimer,
        notificationModalRequested,
        requestNotificationModal,
        clearNotificationModalRequest,
      }}
    >
      {children}
    </TabBarContext.Provider>
  )
}

export const useTabBar = () => {
  const context = useContext(TabBarContext)
  if (!context) {
    // Return safe defaults if not wrapped in provider
    return {
      visible: true,
      showTabBar: () => {},
      hideTabBar: () => {},
      resetTimer: () => {},
      notificationModalRequested: false,
      requestNotificationModal: () => {},
      clearNotificationModalRequest: () => {},
    }
  }
  return context
}
