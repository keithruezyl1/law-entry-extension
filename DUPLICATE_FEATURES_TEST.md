# Duplicate Detection Features Test Guide

This document explains how to test the newly implemented duplicate detection features.

## Features Implemented

### 1. Import Duplicate Detection
- **Location**: When importing entries via JSON file
- **Behavior**: 
  - System checks for duplicates before importing
  - Shows modal with title "Duplicates Found" and subtitle "These entries already exist:"
  - Lists duplicate entry IDs
  - Has "I understand" button
  - Only imports non-duplicate entries

### 2. Real-time Duplicate Detection During Typing
- **Location**: When typing title or canonical_citation in EntryForm
- **Behavior**:
  - Checks for similar entries as you type (debounced by 1 second)
  - Shows modal with title "Similar Entries Found" and subtitle "These entries are similar to what you're typing:"
  - Has "I understand" button
  - Shows similarity percentage

### 3. Create Entry Duplicate Detection
- **Location**: When clicking "Create Entry" button
- **Behavior**:
  - Checks for duplicates before saving
  - Shows modal with title "Duplicates Found" and subtitle "These entries already exist:"
  - Has "Okay" button
  - Prevents saving if duplicates found

## How to Test

### Test 1: Import Duplicate Detection

1. Start the application (both frontend and backend)
2. Go to the dashboard
3. Create a few test entries manually
4. Export the entries to get a JSON file
5. Modify the JSON file to add some entries with duplicate titles/IDs
6. Import the modified JSON file
7. Verify that:
   - Only non-duplicate entries are imported
   - A modal appears showing the duplicate entries
   - The modal has the correct title and "I understand" button

### Test 2: Real-time Duplicate Detection

1. Go to the entry creation form
2. Start typing a title that matches an existing entry
3. Wait 1 second
4. Verify that:
   - A modal appears showing similar entries
   - The modal has the correct title and "I understand" button
   - Similarity percentages are shown

### Test 3: Create Entry Duplicate Detection

1. Fill out the entry form with a title that matches an existing entry
2. Click "Create Entry"
3. Verify that:
   - A modal appears showing duplicate entries
   - The modal has the correct title and "Okay" button
   - The entry is not saved

## API Endpoints Added

### POST /api/kb/check-duplicates
- **Purpose**: Check for duplicate entries
- **Parameters**:
  - `title` (optional): Entry title
  - `canonical_citation` (optional): Entry citation
  - `entry_id` (optional): Entry ID
  - `similarity_threshold` (optional): Similarity threshold (default: 0.8)
- **Response**: List of duplicate entries with match types

### POST /api/kb/check-bulk-duplicates
- **Purpose**: Check for duplicates in bulk import
- **Parameters**:
  - `entries`: Array of entry objects with title, citation, and ID
  - `similarity_threshold` (optional): Similarity threshold (default: 0.8)
- **Response**: List of duplicate entries and mapping

## Components Added

### DuplicateModal Component
- **Location**: `src/components/kb/DuplicateModal.tsx`
- **Features**:
  - Shows duplicate entries in a clean modal
  - Displays match types (exact_title, exact_citation, exact_id, similar)
  - Shows similarity percentages
  - Configurable title, subtitle, and button text
  - Responsive design

## Database Queries

The duplicate detection uses:
1. **Exact matches**: Direct SQL queries for title, citation, and ID
2. **Similar matches**: Vector similarity search using pgvector embeddings
3. **Combined results**: Merges exact and similar matches, removing duplicates

## Configuration

- **Similarity threshold**: Default 0.8 (80% similarity)
- **Debounce timing**: 1 second for real-time detection
- **Search limits**: 10 results for individual checks, 5 for bulk checks
