// CityAutocomplete — Reusable city picker using Google Places Autocomplete
// Restricts results to cities only. Returns formatted "City, State, Country" string.

import React, { useRef, useEffect, useState } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { GOOGLE_PLACES_API_KEY } from '../../config/googlePlaces'

const CityAutocomplete = ({
  value,
  onCitySelect,
  placeholder = 'Select City',
  inputBorderRadius,
}) => {
  const ref = useRef(null)
  const [selectedCity, setSelectedCity] = useState(value || '')

  // Only sync external value on mount or when value changes from parent (e.g. edit mode pre-fill)
  useEffect(() => {
    if (value !== selectedCity) {
      setSelectedCity(value || '')
      if (ref.current) {
        ref.current.setAddressText(value || '')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const handleClear = () => {
    setSelectedCity('')
    ref.current?.setAddressText('')
    onCitySelect('')
  }

  return (
    <View style={styles.wrapper}>
      <GooglePlacesAutocomplete
        ref={ref}
        placeholder={placeholder}
        onPress={(data) => {
          const city = data.description || ''
          setSelectedCity(city)
          onCitySelect(city)
        }}
        onFail={(error) => console.log('🔴 Google Places error:', error)}
        onNotFound={() => {}}
        query={{
          key: GOOGLE_PLACES_API_KEY,
          types: '(cities)',
          language: 'en',
        }}
        fetchDetails={false}
        enablePoweredByContainer={false}
        debounce={300}
        minLength={2}
        disableScroll={true}
        listViewDisplayed="auto"
        keepResultsAfterBlur={true}
        textInputProps={{
          placeholderTextColor: colors.offline,
          returnKeyType: 'search',
          underlineColorAndroid: 'transparent',
          autoCorrect: false,
          spellCheck: false,
        }}
        styles={{
          container: styles.autocompleteContainer,
          textInputContainer: styles.textInputContainer,
          textInput:
            inputBorderRadius !== undefined
              ? { ...styles.textInput, borderRadius: inputBorderRadius }
              : styles.textInput,
          listView: styles.listView,
          row: styles.row,
          description: styles.description,
          separator: styles.separator,
        }}
      />
      {selectedCity ? (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClear}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={16} color={colors.offline} />
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 10,
    marginBottom: 12,
  },
  autocompleteContainer: {
    flex: 0,
    zIndex: 10,
  },
  textInputContainer: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    borderBottomWidth: 0,
  },
  textInput: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textDark,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    height: 'auto',
    marginBottom: 0,
    marginTop: 0,
    marginLeft: 0,
    marginRight: 0,
    textDecorationLine: 'none',
  },
  listView: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 8,
    marginTop: 4,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  description: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textDark,
  },
  separator: {
    height: 1,
    backgroundColor: colors.borderLight,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: 10,
    zIndex: 20,
  },
})

export default CityAutocomplete
