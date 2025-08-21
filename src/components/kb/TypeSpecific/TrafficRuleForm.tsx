import React from 'react';
import { Control } from 'react-hook-form';
import { Entry } from '../../../lib/civilify-kb-schemas';
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '../../ui/Form';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Textarea } from '../../ui/Textarea';
import { StringArray } from '../fields/StringArray';
import { FineScheduleGrid } from '../fields/FineScheduleGrid';

interface TrafficRuleFormProps {
  control: Control<Entry>;
}

export function TrafficRuleForm({ control }: TrafficRuleFormProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
      <FormField
        control={control}
        name="violation_code"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Violation Code</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="e.g., TVR-001"
                className="h-11 px-4 text-base rounded-xl"
              />
            </FormControl>
            <FormDescription>e.g., TVR-001</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={control}
        name="violation_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Violation Name</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="e.g., Reckless Driving"
                className="h-11 px-4 text-base rounded-xl"
              />
            </FormControl>
            <FormDescription>e.g., Reckless Driving</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <div className="md:col-span-2">
        <FineScheduleGrid
          control={control}
          name="fine_schedule"
          label="Fine Schedule"
          help="{ offense_no, amount, currency }"
        />
      </div>
      
      <div className="md:col-span-2">
        <FormField
          control={control}
          name="license_action"
          render={({ field }) => (
            <FormItem>
              <FormLabel>License Action</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="suspension/points/disqualification notes"
                  className="min-h-[88px] px-4 text-base rounded-xl"
                />
              </FormControl>
              <FormDescription>suspension/points/disqualification notes</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="md:col-span-2">
        <StringArray
          control={control}
          name="apprehension_flow"
          label="Apprehension Flow"
          help="on-scene steps for officers"
          placeholder="Enter step"
        />
      </div>
      
      <FormField
        control={control}
        name="lead_agency"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Lead Agency</FormLabel>
            <FormControl>
              <Select
                {...field}
                options={[
                  { value: 'PNP', label: 'PNP' },
                  { value: 'LTO', label: 'LTO' },
                  { value: 'LGU-traffic', label: 'LGU-traffic' }
                ]}
                className="h-11 px-4 text-base rounded-xl"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={control}
        name="police_role"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Police Role</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="e.g., 'secure scene & handoff', 'joint checkpoint'"
                className="h-11 px-4 text-base rounded-xl"
              />
            </FormControl>
            <FormDescription>e.g., 'secure scene & handoff', 'joint checkpoint'</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}


