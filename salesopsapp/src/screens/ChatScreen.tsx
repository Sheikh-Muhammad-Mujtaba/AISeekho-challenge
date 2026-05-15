import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import axios from 'axios';
import Animated, { FadeInUp, FadeInDown, Layout } from 'react-native-reanimated';
import HapticFeedback from 'react-native-haptic-feedback';
import { useAuth } from '../context/AuthContext';
import { theme } from '../theme';
import { config } from '../config';

type Message = {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
};

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

export const ChatScreen = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'system', content: 'Hello! I am your SalesOps Agent. How can I assist you with leads today?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { token, signOut } = useAuth();

  const triggerHaptic = (type: 'impactLight' | 'notificationSuccess' | 'notificationError' | 'selection') => {
    HapticFeedback.trigger(type, hapticOptions);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || isTyping) return;

    triggerHaptic('impactLight');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: inputText.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const backendMessages = [...messages, userMsg]
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const response = await axios.post(
        `${config.API_URL}/chat/`,
        { messages: backendMessages },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      triggerHaptic('notificationSuccess');
      const agentMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'agent', 
        content: response.data.message 
      };
      setMessages(prev => [...prev, agentMsg]);
    } catch (error: any) {
      triggerHaptic('notificationError');
      console.error('Chat error:', error.response?.data || error.message);
      const errorMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'system', 
        content: 'Failed to reach agent. ' + (error.response?.data?.detail || error.message) 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const isSystem = item.role === 'system';

    return (
      <Animated.View 
        entering={isUser ? FadeInDown.springify().damping(12).stiffness(100) : FadeInUp.springify().damping(12).stiffness(100)}
        layout={Layout.springify().damping(14).stiffness(100)}
        style={[
          styles.messageBubble,
          isUser ? styles.userBubble : (isSystem ? styles.systemBubble : styles.agentBubble),
          { alignSelf: isUser ? 'flex-end' : 'flex-start' }
        ]}>
        <Text style={[
          styles.messageText,
          isSystem && { fontStyle: 'italic', color: theme.colors.textMuted }
        ]}>
          {item.content}
        </Text>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SalesOps Agent</Text>
        <TouchableOpacity onPress={signOut}>
          <Icon name="log-out-outline" size={24} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      
      {isTyping && (
        <Animated.View entering={FadeInDown} style={styles.typingIndicator}>
          <ActivityIndicator size="small" color={theme.colors.primaryLight} />
          <Text style={styles.typingText}>Agent is thinking...</Text>
        </Animated.View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask me anything..."
          placeholderTextColor={theme.colors.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity 
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]} 
          onPress={sendMessage}
          disabled={!inputText.trim() || isTyping}
        >
          <Icon name="send" size={20} color={theme.colors.text} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(5, 5, 10, 0.8)',
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  listContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginVertical: 4,
  },
  userBubble: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  agentBubble: {
    backgroundColor: theme.colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderBottomLeftRadius: 4,
  },
  systemBubble: {
    backgroundColor: 'transparent',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  messageText: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    paddingTop: 0,
    gap: theme.spacing.sm,
  },
  typingText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    paddingBottom: Platform.OS === 'ios' ? theme.spacing.xl : theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm + 2,
    paddingBottom: theme.spacing.sm + 2,
    color: theme.colors.text,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 40,
  },
  sendButton: {
    backgroundColor: theme.colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.surfaceHighlight,
  }
});
