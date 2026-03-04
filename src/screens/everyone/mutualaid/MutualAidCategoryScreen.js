// Mutual Aid Category Screen (Reusable)
// Used for Basic Needs, Emergency Response, Legal Support, Technology, LGBTQ+, Health Resources
// Features: +Group, search, numbered list, vet/vetted by, edit post for author

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '../../../theme'
import { fonts } from '../../../theme/typography'
import { useFocusEffect } from '@react-navigation/native'
import { useAuth } from '../../../contexts/AuthContext'
import {
  getMutualAidGroupsByCategory,
  toggleVet,
  deleteMutualAidGroup,
  subscribeToNetworkUsers,
} from '../../../services/everyoneService'
import { buildConnectedUserIds } from '../../../utils/networkGraph'
import { ConfirmModal } from '../../../components/common'
import CityAutocomplete from '../../../components/common/CityAutocomplete'
import LightTabBar from '../../../components/navigation/LightTabBar'
import { playClick } from '../../../services/soundService'

const MutualAidCategoryScreen = ({ route, navigation }) => {
  const { category, title } = route.params
  const { user, userProfile } = useAuth()
  const hiddenUsers = userProfile?.hiddenUsers || []
  const blockedUsers = userProfile?.blockedUsers || []
  const blockedBy = userProfile?.blockedBy || []
  const excludedUsers = [...new Set([...hiddenUsers, ...blockedUsers, ...blockedBy])]
  const myFollowingUsers = userProfile?.subscribedUsers || []
  const [groups, setGroups] = useState([])
  const [filteredGroups, setFilteredGroups] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [sortOrder, setSortOrder] = useState('recent')
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false)
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState({
    visible: false,
    groupId: null,
    groupName: '',
  })
  const [allNetworkUsers, setAllNetworkUsers] = useState([])
  const debounceTimer = useRef(null)
  const lightTabRef = useRef(null)
  const lastScrollY = useRef(0)

  // Subscribe to network users for 2-degree filtering
  useEffect(() => {
    const unsubNetwork = subscribeToNetworkUsers((users) => {
      setAllNetworkUsers(users)
    })
    return () => unsubNetwork()
  }, [])

  const applySorting = (list, order) => {
    const sorted = [...list]
    if (order === 'mostVetted') {
      sorted.sort((a, b) => (b.vettedBy || []).length - (a.vettedBy || []).length)
    }
    return sorted
  }

  // Fetch groups every time screen gains focus (forward or back navigation)
  useFocusEffect(
    useCallback(() => {
      const fetchGroups = async () => {
        const result = await getMutualAidGroupsByCategory(category)
        if (result.success) {
          const connectedUserIds = buildConnectedUserIds(
            user?.uid,
            allNetworkUsers,
            excludedUsers,
            myFollowingUsers
          )
          const visible = result.data.filter(
            (g) => !excludedUsers.includes(g.authorId) && connectedUserIds.has(g.authorId)
          )
          setGroups(visible)
          const query = searchQuery.trim().toLowerCase()
          setFilteredGroups(applyFilters(visible, query, cityFilter, sortOrder))
        }
      }
      fetchGroups()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category, sortOrder, allNetworkUsers])
  )

  // Shared filter helper — applies city + text filters
  const applyFilters = useCallback((list, query, city, order) => {
    let filtered = list
    if (city) {
      filtered = filtered.filter((g) => g.city === city)
    }
    if (query && query.length >= 2) {
      filtered = filtered.filter(
        (g) =>
          (g.name || '').toLowerCase().includes(query) ||
          (g.description || '').toLowerCase().includes(query)
      )
    }
    return applySorting(filtered, order)
  }, [])

  // Live search filter
  const handleSearch = useCallback(
    (text) => {
      setSearchQuery(text)
      if (debounceTimer.current) clearTimeout(debounceTimer.current)

      debounceTimer.current = setTimeout(() => {
        const query = text.trim().toLowerCase()
        setFilteredGroups(applyFilters(groups, query, cityFilter, sortOrder))
      }, 300)
    },
    [groups, sortOrder, cityFilter, applyFilters]
  )

  const handleSortChange = (order) => {
    playClick()
    setSortOrder(order)
    setSortDropdownOpen(false)
    const query = searchQuery.trim().toLowerCase()
    setFilteredGroups(applyFilters(groups, query, cityFilter, order))
  }

  // Re-filter when city filter changes
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase()
    setFilteredGroups(applyFilters(groups, query, cityFilter, sortOrder))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityFilter])

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  const handleToggleVet = async (groupId) => {
    playClick()
    if (!user?.uid) return

    // Optimistically update local state for instant UI feedback
    const updatedGroups = groups.map((g) => {
      if (g.id === groupId) {
        const vettedBy = g.vettedBy || []
        const isCurrentlyVetted = vettedBy.includes(user.uid)
        return {
          ...g,
          vettedBy: isCurrentlyVetted
            ? vettedBy.filter((uid) => uid !== user.uid)
            : [...vettedBy, user.uid],
        }
      }
      return g
    })
    setGroups(updatedGroups)
    const query = searchQuery.trim().toLowerCase()
    setFilteredGroups(applyFilters(updatedGroups, query, cityFilter, sortOrder))

    await toggleVet(groupId, user.uid)
  }

  const handleDeleteGroup = (groupId, groupName) => {
    playClick()
    setDeleteGroupConfirm({ visible: true, groupId, groupName })
  }

  const handleConfirmDeleteGroup = async () => {
    playClick()
    const { groupId } = deleteGroupConfirm
    setDeleteGroupConfirm({ visible: false, groupId: null, groupName: '' })
    await deleteMutualAidGroup(groupId)
    const updated = groups.filter((g) => g.id !== groupId)
    setGroups(updated)
    const query = searchQuery.trim().toLowerCase()
    setFilteredGroups(applyFilters(updated, query, cityFilter, sortOrder))
  }

  const formatNumber = (index) => index.toString().padStart(3, '0')

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
          <View style={styles.headerOuter}>
            <LinearGradient
              colors={['#d8f434', '#b3f425', '#93f478']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerRow}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                style={styles.headerHighlight}
              />
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 4 }}
              >
                <Ionicons name="chevron-back" size={24} color={colors.textDark} />
              </TouchableOpacity>
              <Ionicons
                name="globe-outline"
                size={22}
                color={colors.textDark}
                style={{ marginLeft: 4 }}
              />
              <Text style={styles.title}>{title}</Text>
            </LinearGradient>
          </View>

          {/* Description */}
          <Text style={styles.description}>
            Add groups or resource links to spread the power. Vet organizations you've worked with
            and keep the community purposeful.{' '}
          </Text>

          {/* + Group Button */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.addButtonOuter}
              onPress={() => { playClick(); navigation.navigate('MutualAidCreate', { category, title }) }}
            >
              <LinearGradient
                colors={['#cafb6c', '#71f200', '#23ff0d']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addButton}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                  style={styles.addButtonHighlight}
                />
                <Ionicons name="add" size={16} color={colors.textDark} />
                <Text style={styles.addButtonText}>Group</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
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
                  setFilteredGroups(applyFilters(groups, '', cityFilter, sortOrder))
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

          {/* Sort Dropdown */}
          <View style={styles.sortContainer}>
            <TouchableOpacity
              style={styles.sortToggle}
              onPress={() => { playClick(); setSortDropdownOpen(!sortDropdownOpen) }}
            >
              <Text style={styles.sortLabel}>
                {sortOrder === 'recent' ? 'Most Recent' : 'Most Vetted'}
              </Text>
              <Ionicons
                name={sortDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.textDark}
              />
            </TouchableOpacity>

            {sortDropdownOpen && (
              <View style={styles.sortDropdown}>
                <TouchableOpacity
                  style={[styles.sortOption, sortOrder === 'recent' && styles.sortOptionActive]}
                  onPress={() => handleSortChange('recent')}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      sortOrder === 'recent' && styles.sortOptionTextActive,
                    ]}
                  >
                    Most Recent
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortOption, sortOrder === 'mostVetted' && styles.sortOptionActive]}
                  onPress={() => handleSortChange('mostVetted')}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      sortOrder === 'mostVetted' && styles.sortOptionTextActive,
                    ]}
                  >
                    Most Vetted
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Groups List */}
          <View style={styles.listContainer}>
            {filteredGroups.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No groups yet. Add one!</Text>
              </View>
            ) : (
              filteredGroups.map((group, index) => {
                const isVetted = (group.vettedBy || []).includes(user?.uid)
                const isAuthor = group.authorId === user?.uid

                return (
                  <View key={group.id} style={styles.groupRow}>
                    {/* Top Row: Number + Name + Arrow */}
                    <View style={styles.groupTopRow}>
                      <Text style={styles.groupNumber}>{formatNumber(index)}</Text>
                      <Text style={styles.groupName} numberOfLines={1}>
                        {group.name}
                      </Text>
                      <TouchableOpacity
                        style={styles.arrowButtonOuter}
                        onPress={() => navigation.navigate('MutualAidPost', { groupId: group.id })}
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

                    {/* Bottom Row: Vet + Vetted By + Edit Post */}
                    <View style={styles.groupBottomRow}>
                      <TouchableOpacity
                        style={[styles.vetButton, isVetted && styles.vetButtonActive]}
                        onPress={() => handleToggleVet(group.id)}
                      >
                        <Text
                          style={[styles.vetButtonText, isVetted && styles.vetButtonTextActive]}
                        >
                          vet
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.vettedByButton}
                        onPress={() => { playClick(); navigation.navigate('VettedMembers', { groupId: group.id }) }}
                      >
                        <Text style={styles.vettedByText}>vetted by...</Text>
                      </TouchableOpacity>

                      {isAuthor && (
                        <>
                          <TouchableOpacity
                            style={styles.deleteIconButton}
                            onPress={() => handleDeleteGroup(group.id, group.name)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="trash-outline" size={14} color={colors.offline} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              playClick()
                              navigation.navigate('MutualAidPost', {
                                groupId: group.id,
                                editMode: true,
                              })
                            }}
                          >
                            <Text style={styles.editPostLink}>Edit Post</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                )
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Delete Group Confirm Modal */}
      <ConfirmModal
        visible={deleteGroupConfirm.visible}
        title="Delete Group"
        message={`Are you sure you want to delete "${deleteGroupConfirm.groupName}"?`}
        confirmText="Delete"
        onConfirm={handleConfirmDeleteGroup}
        onCancel={() => setDeleteGroupConfirm({ visible: false, groupId: null, groupName: '' })}
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

  // Header
  headerOuter: {
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: '#b3f425',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  headerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.textDark,
    marginLeft: 30,
  },
  description: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
    lineHeight: 18,
    marginBottom: 16,
  },

  // Add Button
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

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
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

  // Sort Dropdown
  sortContainer: {
    marginBottom: 12,
  },
  sortToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  sortLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textDark,
  },
  sortDropdown: {
    marginTop: 4,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  sortOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  sortOptionActive: {
    backgroundColor: colors.secondary,
  },
  sortOptionText: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textDark,
  },
  sortOptionTextActive: {
    fontFamily: fonts.bold,
  },

  // List
  listContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
  },
  groupRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  groupTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupNumber: {
    fontSize: 13,
    fontFamily: fonts.mono,
    color: colors.textDark,
    marginRight: 12,
    minWidth: 30,
  },
  groupName: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textDark,
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

  // Bottom Row
  groupBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  vetButton: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  vetButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  vetButtonText: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.textDark,
  },
  vetButtonTextActive: {
    color: colors.textDark,
  },
  vetNote: {
    fontSize: 9,
    fontFamily: fonts.italic,
    color: colors.offline,
  },
  vettedByButton: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  vettedByText: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: colors.textDark,
  },
  deleteIconButton: {
    marginLeft: 'auto',
    marginRight: 6,
  },
  editPostLink: {
    fontSize: 11,
    fontFamily: fonts.italic,
    color: colors.textDark,
    textDecorationLine: 'underline',
  },

  // Empty
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

export default MutualAidCategoryScreen
