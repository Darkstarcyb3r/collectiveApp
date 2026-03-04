// Landing Screen
// First screen users see with Login and Sign Up options

import React, { useState } from 'react'
import { View, StyleSheet, Image, SafeAreaView, StatusBar, Dimensions } from 'react-native'
import { Button } from '../../components/common'
import { colors } from '../../theme'
import { playClick } from '../../services/soundService'

const { width, height } = Dimensions.get('window')

const LandingScreen = ({ navigation }) => {
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={[styles.content, !imageLoaded && { opacity: 0 }]}>
        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
            onLoad={() => setImageLoaded(true)}
          />
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <Button
            title="Login"
            variant="gradient"
            size="large"
            onPress={() => { playClick(); navigation.navigate('Login'); }}
            style={styles.button}
          />

          <Button
            title="Sign Up"
            variant="gradient"
            size="large"
            onPress={() => { playClick(); navigation.navigate('SignUp'); }}
            style={styles.button}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 40,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 80,
  },
  logo: {
    width: width * 0.7,
    height: height * 0.35,
  },
  buttonContainer: {
    gap: 20,
  },
  button: {
    width: '100%',
  },
})

export default LandingScreen
