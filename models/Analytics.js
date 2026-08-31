'use strict';

const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema(
  {
    visitorId: {
      type: String,
      index: true,
      default: null,
      maxlength: 100,
    },

    sessionId: {
      type: String,
      index: true,
      default: null,
      maxlength: 100,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    event: {
      type: String,
      enum: ['PAGE_VIEW', 'SEARCH', 'VIEW_WORK', 'DOWNLOAD_WORK', 'LOGIN', 'REGISTER'],
      required: true,
      index: true,
    },

    page: {
      type: String,
      default: null,
      maxlength: 500,
      index: true,
    },

    workId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Content',
      default: null,
      index: true,
    },

    searchKeyword: {
      type: String,
      default: null,
      maxlength: 200,
    },

    device: {
      type: String,
      enum: ['Desktop', 'Mobile', 'Tablet', 'Unknown'],
      default: 'Unknown',
    },

    browser: {
      type: String,
      default: null,
      maxlength: 100,
    },

    os: {
      type: String,
      default: null,
      maxlength: 100,
    },

    country: {
      type: String,
      default: null,
      maxlength: 100,
    },

    region: {
      type: String,
      default: null,
      maxlength: 100,
    },

    referrer: {
      type: String,
      default: null,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    collection: 'analytics_events',
  }
);

analyticsSchema.index({ createdAt: -1, event: 1 });
analyticsSchema.index({ event: 1, createdAt: -1 });
analyticsSchema.index({ visitorId: 1, createdAt: -1 });

module.exports = mongoose.model('Analytics', analyticsSchema);
