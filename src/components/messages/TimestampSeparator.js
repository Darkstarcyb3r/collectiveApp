// TimestampSeparator - Date/time separator between message groups

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'

const formatTimestamp = (date) => {
  if (!date) return ''

  const now = new Date()
  const messageDate = date instanceof Date ? date : new Date(date)
  const diffMs = now - messageDate
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const days = ['Sun', 'Mon', 'Tues', 'Wed', 'Thurs', 'Fri', 'Sat']
  const hours = messageDate.getHours()
  const minutes = messageDate.getMinutes().toString().padStart(2, '0')
  const _ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12
  const timeStr = `${displayHour}:${minutes}`

  if (diffDays === 0) {
    return `Today ${timeStr}`
  } else if (diffDays === 1) {
    return `Yesterday ${timeStr}`
  } else if (diffDays < 7) {
    return `${days[messageDate.getDay()]} ${timeStr}`
  } else {
    const month = messageDate.getMonth() + 1
    const day = messageDate.getDate()
    return `${month}/${day} ${timeStr}`
  }
}

const TimestampSeparator = ({ timestamp }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{formatTimestamp(timestamp)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 12,
  },
  text: {
    color: colors.offline,
    fontSize: 12,
    fontFamily: fonts.regular,
  },
})

export default TimestampSeparator
