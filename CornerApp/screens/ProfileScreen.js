import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useSelector((state) => state.auth);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.avatarContainer, { backgroundColor: colors.primary }]}>
          <Ionicons name="person" size={48} color="#fff" />
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{user?.name || 'Usuario'}</Text>
        <Text style={[styles.email, { color: colors.textSecondary }]}>
          {user?.email || ''}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Información Personal</Text>
        
        <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color="#000000" />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: '#4b5563' }]}>Nombre</Text>
              <Text style={[styles.infoValue, { color: '#000000' }]}>{user?.name || 'No especificado'}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color="#000000" />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: '#4b5563' }]}>Email</Text>
              <Text style={[styles.infoValue, { color: '#000000' }]}>{user?.email || 'No especificado'}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={20} color="#000000" />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: '#4b5563' }]}>Teléfono</Text>
              <Text style={[styles.infoValue, { color: '#000000' }]}>
                {user?.phone || 'No especificado'}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color="#000000" />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: '#4b5563' }]}>Dirección</Text>
              <Text style={[styles.infoValue, { color: '#000000' }]}>
                {user?.defaultAddress || 'No especificada'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.7}
        >
          <View style={[styles.gradientButton, { backgroundColor: '#001219' }]}>
            <Ionicons name="create-outline" size={20} color="#ffffff" />
            <Text style={styles.editButtonText}>Editar Perfil</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: 32,
    paddingTop: 40,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  actions: {
    padding: 16,
    paddingBottom: 32,
  },
  editButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProfileScreen;

