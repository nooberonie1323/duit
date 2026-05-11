import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Calendar from 'react-native-calendars/src/calendar';

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: Date) => void;
  value?: Date | null;
  minimumDate?: Date;
  maximumDate?: Date;
  title?: string;
}

export function CalendarModal({ visible, onClose, onSelect, value, minimumDate, maximumDate, title }: Props) {
  const selected = value ? toDateString(value) : '';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', width: '100%' }}>
            {title && (
              <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 0 }}>
                <Text style={{ fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#111827' }}>
                  {title}
                </Text>
              </View>
            )}
            <Calendar
              onDayPress={day => {
                onSelect(new Date(`${day.dateString}T12:00:00`));
              }}
              markedDates={selected ? { [selected]: { selected: true, selectedColor: '#16A34A', selectedTextColor: '#fff' } } : {}}
              minDate={minimumDate ? toDateString(minimumDate) : undefined}
              maxDate={maximumDate ? toDateString(maximumDate) : undefined}
              theme={{
                calendarBackground: '#ffffff',
                todayTextColor: '#16A34A',
                todayBackgroundColor: '#DCFCE7',
                selectedDayBackgroundColor: '#16A34A',
                selectedDayTextColor: '#ffffff',
                arrowColor: '#16A34A',
                textSectionTitleColor: '#6B7280',
                dayTextColor: '#111827',
                textDisabledColor: '#D1D5DB',
                monthTextColor: '#111827',
                textDayFontFamily: 'PlusJakartaSans_400Regular',
                textMonthFontFamily: 'PlusJakartaSans_700Bold',
                textDayHeaderFontFamily: 'PlusJakartaSans_500Medium',
                textDayFontSize: 13,
                textMonthFontSize: 14,
                textDayHeaderFontSize: 11,
                'stylesheet.calendar.main': {
                  week: {
                    marginTop: 2,
                    marginBottom: 2,
                    flexDirection: 'row',
                    justifyContent: 'space-around',
                  },
                },
                'stylesheet.day.basic': {
                  base: {
                    width: 32,
                    height: 32,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 16,
                  },
                  today: {
                    backgroundColor: '#DCFCE7',
                    borderRadius: 16,
                  },
                  selected: {
                    backgroundColor: '#16A34A',
                    borderRadius: 16,
                  },
                },
              } as any}
            />
            <Pressable
              onPress={onClose}
              style={{ paddingVertical: 14, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F3F4F6', marginHorizontal: 16 }}
            >
              <Text style={{ color: '#6B7280', fontFamily: 'PlusJakartaSans_500Medium', fontSize: 15 }}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
