// Barter Market Landing Screen
// + Post button, search, offering/looking-for filter dropdowns, numbered list
// Only the author sees "Edit Post" link per row

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Animated,
} from 'react-native'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect } from '@react-navigation/native'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useAuth } from '../../../contexts/AuthContext'
import {
  getBarterPosts,
  deleteBarterPost,
  subscribeToNetworkUsers,
} from '../../../services/everyoneService'
import { buildConnectedUserIds } from '../../../utils/networkGraph'
import { ConfirmModal } from '../../../components/common'
import CityAutocomplete from '../../../components/common/CityAutocomplete'
import LightTabBar from '../../../components/navigation/LightTabBar'
import { playClick } from '../../../services/soundService'

const BARTER_TYPES = ['Service', 'Good', 'Currency']
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const formatPostDate = (timestamp) => {
  if (!timestamp) return ''
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

const BarterMarketLandingScreen = ({ navigation }) => {
  const { user, userProfile } = useAuth()
  const hiddenUsers = userProfile?.hiddenUsers || []
  const blockedUsers = userProfile?.blockedUsers || []
  const blockedBy = userProfile?.blockedBy || []
  const excludedUsers = [...new Set([...hiddenUsers, ...blockedUsers, ...blockedBy])]
  const myFollowingUsers = userProfile?.subscribedUsers || []
  const [posts, setPosts] = useState([])
  const [filteredPosts, setFilteredPosts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [filterOffering, setFilterOffering] = useState('')
  const [filterLookingFor, setFilterLookingFor] = useState('')
  const [offeringDropdownOpen, setOfferingDropdownOpen] = useState(false)
  const [lookingForDropdownOpen, setLookingForDropdownOpen] = useState(false)
  const [allNetworkUsers, setAllNetworkUsers] = useState([])
  const [deletePostConfirm, setDeletePostConfirm] = useState({ visible: false, postId: null })
  const debounceTimer = useRef(null)
  const lightTabRef = useRef(null)
  const lastScrollY = useRef(0)

  const applyFilters = (list, search, offering, lookingFor, city) => {
    let result = [...list]

    // City filter
    if (city) {
      result = result.filter((p) => p.city === city)
    }

    // Text search
    const query = (search || '').trim().toLowerCase()
    if (query && query.length >= 2) {
      result = result.filter(
        (p) =>
          (p.title || '').toLowerCase().includes(query) ||
          (p.description || '').toLowerCase().includes(query)
      )
    }

    // Offering type filter
    if (offering) {
      result = result.filter((p) => p.offeringType === offering)
    }

    // Looking for type filter
    if (lookingFor) {
      result = result.filter((p) => p.lookingForType === lookingFor)
    }

    return result
  }

  const filterOfferingRef = useRef(filterOffering)
  const filterLookingForRef = useRef(filterLookingFor)
  const searchQueryRef = useRef(searchQuery)
  const cityFilterRef = useRef(cityFilter)
  filterOfferingRef.current = filterOffering
  filterLookingForRef.current = filterLookingFor
  searchQueryRef.current = searchQuery
  cityFilterRef.current = cityFilter

  useEffect(() => {
    if (!userProfile?.everyoneNetworkEnabled) {
      navigation.goBack()
    }

    // Subscribe to network users for 2-degree filtering
    const unsubNetwork = subscribeToNetworkUsers((users) => {
      setAllNetworkUsers(users)
    })
    return () => unsubNetwork()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFocusEffect(
    useCallback(() => {
      const fetchPosts = async () => {
        const result = await getBarterPosts()
        if (result.success) {
          const connectedUserIds = buildConnectedUserIds(
            user?.uid,
            allNetworkUsers,
            excludedUsers,
            myFollowingUsers
          )
          const visible = result.data.filter(
            (p) => !excludedUsers.includes(p.authorId) && connectedUserIds.has(p.authorId)
          )
          setPosts(visible)
          setFilteredPosts(
            applyFilters(
              visible,
              searchQueryRef.current,
              filterOfferingRef.current,
              filterLookingForRef.current,
              cityFilterRef.current
            )
          )
        }
      }
      fetchPosts()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allNetworkUsers])
  )

  const handleSearch = useCallback(
    (text) => {
      setSearchQuery(text)
      if (debounceTimer.current) clearTimeout(debounceTimer.current)

      debounceTimer.current = setTimeout(() => {
        setFilteredPosts(applyFilters(posts, text, filterOffering, filterLookingFor, cityFilter))
      }, 300)
    },
    [posts, filterOffering, filterLookingFor, cityFilter]
  )

  const handleFilterOffering = (type) => {
    playClick()
    const newValue = filterOffering === type ? '' : type
    setFilterOffering(newValue)
    setOfferingDropdownOpen(false)
    setFilteredPosts(applyFilters(posts, searchQuery, newValue, filterLookingFor, cityFilter))
  }

  const handleFilterLookingFor = (type) => {
    playClick()
    const newValue = filterLookingFor === type ? '' : type
    setFilterLookingFor(newValue)
    setLookingForDropdownOpen(false)
    setFilteredPosts(applyFilters(posts, searchQuery, filterOffering, newValue, cityFilter))
  }

  // Re-filter when city filter changes
  useEffect(() => {
    setFilteredPosts(applyFilters(posts, searchQuery, filterOffering, filterLookingFor, cityFilter))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityFilter])

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  const handleSwipeDelete = (postId) => {
    playClick()
    setDeletePostConfirm({ visible: true, postId })
  }

  const handleConfirmDeletePost = async () => {
    const pid = deletePostConfirm.postId
    setDeletePostConfirm({ visible: false, postId: null })
    await deleteBarterPost(pid)
    const updated = posts.filter((p) => p.id !== pid)
    setPosts(updated)
    setFilteredPosts(
      applyFilters(updated, searchQuery, filterOffering, filterLookingFor, cityFilter)
    )
  }

  const renderPostDeleteAction = (progress, postId) => {
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [80, 0],
    })
    return (
      <Animated.View style={[styles.postDeleteAction, { transform: [{ translateX: trans }] }]}>
        <TouchableOpacity onPress={() => handleSwipeDelete(postId)} style={styles.postDeleteButton}>
          <Ionicons name="trash-outline" size={18} color={colors.offline} />
        </TouchableOpacity>
      </Animated.View>
    )
  }

  const handleScroll = (event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y
    const contentHeight = event.nativeEvent.contentSize.height
    const layoutHeight = event.nativeEvent.layoutMeasurement.height
    const scrollDirection = currentScrollY > lastScrollY.current ? 'down' : 'up'
    const scrollableHeight = contentHeight - layoutHeight
    const scrollPercent = scrollableHeight > 0 ? currentScrollY / scrollableHeight : 0
    if (scrollDirection === 'down' && scrollPercent > 0.5) {
      lightTabRef.current?.hide()
    } else if (scrollDirection === 'up') {
      lightTabRef.current?.show()
    }
    lastScrollY.current = currentScrollY
  }
  const handleScrollBeginDrag = () => {
    lightTabRef.current?.show()
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.backgroundLight} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={16}
      >
        <View style={styles.mainContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ padding: 4 }}
            >
              <Ionicons name="chevron-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Ionicons name="globe-outline" size={22} color="#ffffff" style={{ marginLeft: 4 }} />
            <Text style={styles.title}>Barter Market</Text>
          </View>

          {/* Description */}
          <Text style={styles.description}>
            Resources in the community can be time, skills, or material items. Post what you are
            offering and/or looking for. Send a private message to connect and discuss.
          </Text>
          <Text style={styles.expiryNotice}>Posts are removed after 60 days.</Text>

          {/* + Post Button */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.addButtonOuter}
              onPress={() => { playClick(); navigation.navigate('BarterMarketCreate') }}
            >
              <LinearGradient colors={['#cafb6c', '#71f200', '#23ff0d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addButton}>
                <LinearGradient colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']} style={styles.addButtonHighlight} />
                <Ionicons name="add" size={16} color={colors.textDark} />
                <Text style={styles.addButtonText}>Post</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color={colors.offline} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="Search by keyword..."
              placeholderTextColor={colors.offline}
              underlineColorAndroid="transparent"
              autoCorrect={false}
              spellCheck={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  playClick()
                  setSearchQuery('')
                  setFilteredPosts(
                    applyFilters(posts, '', filterOffering, filterLookingFor, cityFilter)
                  )
                }}
              >
                <Ionicons name="close-circle" size={16} color={colors.offline} />
              </TouchableOpacity>
            )}
          </View>

          {/* City Filter */}
          {cityFilter !== 'Global' && (
            <CityAutocomplete
              value={cityFilter}
              onCitySelect={(selectedCity) => setCityFilter(selectedCity)}
              placeholder="Filter by city or..."
            />
          )}

          {/* Global Filter Toggle */}
          <TouchableOpacity
            style={styles.globalFilterRow}
            onPress={() => {
              playClick()
              if (cityFilter === 'Global') {
                setCityFilter('')
              } else {
                setCityFilter('Global')
              }
            }}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.globalCheckbox,
                cityFilter === 'Global' && styles.globalCheckboxActive,
              ]}
            >
              {cityFilter === 'Global' && (
                <Ionicons name="checkmark" size={14} color={colors.textDark} />
              )}
            </View>
            <Ionicons
              name="globe-outline"
              size={14}
              color={colors.textDark}
              style={{ marginRight: 4 }}
            />
            <Text style={styles.globalFilterLabel}>Global / Digital</Text>
          </TouchableOpacity>

          {/* Filter Dropdowns */}
          <View style={styles.filterRow}>
            {/* Offering Filter */}
            <View style={styles.filterColumn}>
              <Text style={styles.filterLabel}>Offering:</Text>
              <TouchableOpacity
                style={styles.filterToggle}
                onPress={() => {
                  playClick()
                  setOfferingDropdownOpen(!offeringDropdownOpen)
                  setLookingForDropdownOpen(false)
                }}
              >
                <Text style={filterOffering ? styles.filterValue : styles.filterPlaceholder}>
                  {filterOffering || 'All'}
                </Text>
                <Ionicons
                  name={offeringDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color={colors.textDark}
                />
              </TouchableOpacity>
              {offeringDropdownOpen && (
                <View style={styles.filterDropdown}>
                  <TouchableOpacity
                    style={[styles.filterOption, !filterOffering && styles.filterOptionActive]}
                    onPress={() => {
                      playClick()
                      setFilterOffering('')
                      setOfferingDropdownOpen(false)
                      setFilteredPosts(
                        applyFilters(posts, searchQuery, '', filterLookingFor, cityFilter)
                      )
                    }}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        !filterOffering && styles.filterOptionTextActive,
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>
                  {BARTER_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.filterOption,
                        filterOffering === type && styles.filterOptionActive,
                      ]}
                      onPress={() => handleFilterOffering(type)}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          filterOffering === type && styles.filterOptionTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Looking For Filter */}
            <View style={styles.filterColumn}>
              <Text style={styles.filterLabel}>Looking for:</Text>
              <TouchableOpacity
                style={styles.filterToggle}
                onPress={() => {
                  playClick()
                  setLookingForDropdownOpen(!lookingForDropdownOpen)
                  setOfferingDropdownOpen(false)
                }}
              >
                <Text style={filterLookingFor ? styles.filterValue : styles.filterPlaceholder}>
                  {filterLookingFor || 'All'}
                </Text>
                <Ionicons
                  name={lookingForDropdownOpen ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color={colors.textDark}
                />
              </TouchableOpacity>
              {lookingForDropdownOpen && (
                <View style={styles.filterDropdown}>
                  <TouchableOpacity
                    style={[styles.filterOption, !filterLookingFor && styles.filterOptionActive]}
                    onPress={() => {
                      playClick()
                      setFilterLookingFor('')
                      setLookingForDropdownOpen(false)
                      setFilteredPosts(
                        applyFilters(posts, searchQuery, filterOffering, '', cityFilter)
                      )
                    }}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        !filterLookingFor && styles.filterOptionTextActive,
                      ]}
                    >
                      All
                    </Text>
                  </TouchableOpacity>
                  {BARTER_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.filterOption,
                        filterLookingFor === type && styles.filterOptionActive,
                      ]}
                      onPress={() => handleFilterLookingFor(type)}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          filterLookingFor === type && styles.filterOptionTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Posts List */}
          <View style={styles.listContainer}>
            {filteredPosts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No posts yet. Be the first!</Text>
              </View>
            ) : (
              filteredPosts.map((post, _index) => {
                const isAuthor = post.authorId === user?.uid
                return (
                  <Swipeable
                    key={post.id}
                    renderRightActions={
                      isAuthor ? (progress) => renderPostDeleteAction(progress, post.id) : undefined
                    }
                    rightThreshold={40}
                    overshootRight={false}
                    enabled={isAuthor}
                  >
                    <View style={styles.postRow}>
                      <View style={styles.postTopRow}>
                        {post.authorPhoto ? (
                          <Image
                            source={{ uri: post.authorPhoto, cache: 'reload' }}
                            style={styles.postAvatar}
                          />
                        ) : (
                          <View style={styles.postAvatarPlaceholder}>
                            <Ionicons name="person" size={14} color={colors.offline} />
                          </View>
                        )}
                        <View style={styles.postTitleColumn}>
                          <View style={styles.postOfferingRow}>
                            <Text style={styles.postOfferingLabel}>offering:</Text>
                            {post.date && (
                              <Text style={styles.postDateLabel}>{formatPostDate(post.date)}</Text>
                            )}
                          </View>
                          <Text style={styles.postTitle} numberOfLines={1}>
                            {post.title || post.lookingForText || 'Barter Skill or Item'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.arrowButtonOuter}
                          onPress={() => {
                            playClick()
                            navigation.navigate('BarterMarketPost', { postId: post.id })
                          }}
                        >
                          <LinearGradient
                            colors={['#d8f434', '#b3f425', '#93f478']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.arrowButton}
                          >
                            <LinearGradient
                              colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                              style={styles.arrowButtonHighlight}
                            />
                            <Ionicons name="arrow-forward" size={20} color={colors.textDark} />
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                      {isAuthor && (
                        <View style={styles.editPostContainer}>
                          <TouchableOpacity
                            onPress={() => {
                              playClick()
                              navigation.navigate('BarterMarketPost', {
                                postId: post.id,
                                editMode: true,
                              })
                            }}
                          >
                            <Text style={styles.editPostLink}>Edit Post</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </Swipeable>
                )
              })
            )}
          </View>
        </View>
      </ScrollView>
      {/* Delete Post Confirm Modal */}
      <ConfirmModal
        visible={deletePostConfirm.visible}
        title="Delete Post"
        message="Are you sure you want to delete this post?"
        confirmText="Delete"
        onConfirm={handleConfirmDeletePost}
        onCancel={() => setDeletePostConfirm({ visible: false, postId: null })}
      />

      <LightTabBar ref={lightTabRef} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 120,
  },
  mainContainer: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: '#ffffff',
    marginLeft: 30,
  },
  description: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
    lineHeight: 18,
    marginBottom: 4,
  },
  expiryNotice: {
    fontSize: 10,
    fontFamily: fonts.italic,
    color: colors.offline,
    marginBottom: 16,
  },
  buttonRow: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  addButtonOuter: {
    borderRadius: 20,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  addButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginLeft: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.textDark,
    marginLeft: 8,
    textDecorationLine: 'none',
  },

  // Global Filter
  globalFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  globalCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    marginRight: 10,
  },
  globalCheckboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  globalFilterLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.textDark,
  },

  // Filter Dropdowns
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  filterColumn: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontFamily: fonts.mono,
    color: colors.textDark,
    marginBottom: 4,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterValue: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textDark,
  },
  filterPlaceholder: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.offline,
  },
  filterDropdown: {
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  filterOptionActive: {
    backgroundColor: colors.secondary,
  },
  filterOptionText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
  },
  filterOptionTextActive: {
    fontFamily: fonts.bold,
  },

  // List
  listContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  postRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  postTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 12,
    backgroundColor: colors.borderLight,
  },
  postAvatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 12,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postTitleColumn: {
    flex: 1,
  },
  postOfferingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  postOfferingLabel: {
    fontSize: 10,
    fontFamily: fonts.italic,
    color: colors.offline,
    marginBottom: 1,
  },
  postTitle: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.textDark,
  },
  postDateLabel: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: colors.offline,
  },
  arrowButtonOuter: {
    borderRadius: 20,
    marginLeft: 8,
    shadowColor: '#b3f425',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  arrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  arrowButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  editPostContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 4,
  },
  editPostLink: {
    fontSize: 11,
    fontFamily: fonts.italic,
    color: colors.textDark,
    textDecorationLine: 'underline',
  },
  // Swipe delete
  postDeleteAction: {
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
  },
  postDeleteButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
  },

  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontFamily: fonts.italic,
    color: colors.offline,
  },
})

export default BarterMarketLandingScreen
