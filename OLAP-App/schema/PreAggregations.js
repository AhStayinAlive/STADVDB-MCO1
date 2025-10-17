// Advanced Pre-aggregations for Performance Optimization
// This file contains optimized pre-aggregation configurations

cube(`CreditMetricsOptimized`, {
  extends: CreditMetrics,
  
  preAggregations: {
    // High-performance quarterly rollups
    quarterlyRollup: {
      measures: [
        CreditMetrics.totalOriginations,
        CreditMetrics.totalOriginationAmount,
        CreditMetrics.totalBalanceAmount,
        CreditMetrics.averageDefaultRate,
        CreditMetrics.averagePrimeRate,
        CreditMetrics.averageLendingRate,
        CreditMetrics.primeLendingSpread
      ],
      dimensions: [
        DateDimension.year,
        DateDimension.quarter,
        ProductDimension.productType,
        GeographyDimension.country
      ],
      timeDimension: DateDimension.quarterStart,
      granularity: `quarter`,
      refreshKey: {
        every: `30 minutes`
      },
      indexes: {
        creditMetricsQuarterly: {
          columns: [
            DateDimension.year,
            DateDimension.quarter,
            ProductDimension.productType
          ]
        }
      }
    },
    
    // Monthly granular rollups for detailed analysis
    monthlyRollup: {
      measures: [
        CreditMetrics.totalOriginations,
        CreditMetrics.totalOriginationAmount,
        CreditMetrics.averageDefaultRate
      ],
      dimensions: [
        ProductDimension.productType,
        ProductDimension.segment,
        GeographyDimension.country,
        GeographyDimension.stateProvince
      ],
      timeDimension: DateDimension.quarterStart,
      granularity: `month`,
      refreshKey: {
        every: `1 hour`
      },
      indexes: {
        creditMetricsMonthly: {
          columns: [
            DateDimension.year,
            DateDimension.quarter,
            ProductDimension.productType,
            GeographyDimension.country
          ]
        }
      }
    },
    
    // Risk analysis specific rollup
    riskAnalysisRollup: {
      measures: [
        CreditMetrics.highRiskAccounts,
        CreditMetrics.mediumRiskAccounts,
        CreditMetrics.lowRiskAccounts,
        CreditMetrics.averageDefaultRate,
        CreditMetricsCalculated.portfolioHealthScore
      ],
      dimensions: [
        CreditMetrics.riskCategory,
        ProductDimension.productType,
        GeographyDimension.country
      ],
      timeDimension: DateDimension.quarterStart,
      granularity: `quarter`,
      refreshKey: {
        every: `15 minutes`
      }
    },
    
    // Product performance rollup
    productPerformanceRollup: {
      measures: [
        CreditMetrics.totalOriginationAmount,
        CreditMetrics.averageDefaultRate,
        CreditMetricsCalculated.marketShareByProduct,
        CreditMetricsCalculated.performanceVsAverage,
        CreditMetricsCalculated.volatilityIndex
      ],
      dimensions: [
        ProductDimension.productType,
        ProductDimension.segment,
        CreditMetricsCalculated.performanceCategory
      ],
      timeDimension: DateDimension.quarterStart,
      granularity: `quarter`,
      refreshKey: {
        every: `1 hour`
      }
    },
    
    // Geographic analysis rollup
    geographicRollup: {
      measures: [
        CreditMetrics.totalOriginationAmount,
        CreditMetrics.totalBalanceAmount,
        CreditMetrics.averageDefaultRate,
        CreditMetrics.totalOriginations
      ],
      dimensions: [
        GeographyDimension.country,
        GeographyDimension.stateProvince,
        GeographyDimension.city
      ],
      timeDimension: DateDimension.quarterStart,
      granularity: `quarter`,
      refreshKey: {
        every: `2 hours`
      }
    },
    
    // Yearly summary for executive dashboards
    yearlySummary: {
      measures: [
        CreditMetrics.totalOriginations,
        CreditMetrics.totalOriginationAmount,
        CreditMetrics.totalBalanceAmount,
        CreditMetrics.averageDefaultRate,
        CreditMetricsCalculated.originationGrowthRate,
        CreditMetricsCalculated.balanceGrowthRate,
        CreditMetricsCalculated.portfolioHealthScore
      ],
      dimensions: [
        DateDimension.year,
        ProductDimension.productType,
        GeographyDimension.country
      ],
      timeDimension: DateDimension.quarterStart,
      granularity: `year`,
      refreshKey: {
        every: `6 hours`
      }
    },
    
    // Real-time dashboard rollup (frequent refresh)
    realtimeDashboard: {
      measures: [
        CreditMetrics.totalOriginations,
        CreditMetrics.totalOriginationAmount,
        CreditMetrics.averageDefaultRate,
        CreditMetrics.primeLendingSpread
      ],
      dimensions: [
        DateDimension.quarterLabel,
        ProductDimension.productType,
        CreditMetrics.riskCategory
      ],
      timeDimension: DateDimension.quarterStart,
      granularity: `quarter`,
      refreshKey: {
        every: `5 minutes`
      }
    }
  }
});

// Additional optimization configurations
cube(`PerformanceOptimizations`, {
  sql: `SELECT 1`,
  
  measures: {
    count: {
      type: `count`
    }
  },
  
  preAggregations: {
    // Cache warming for common queries
    commonQueriesCache: {
      measures: [
        CreditMetrics.totalOriginationAmount,
        CreditMetrics.totalBalanceAmount,
        CreditMetrics.averageDefaultRate
      ],
      dimensions: [
        DateDimension.quarterLabel,
        ProductDimension.productType,
        GeographyDimension.country
      ],
      timeDimension: DateDimension.quarterStart,
      granularity: `quarter`,
      refreshKey: {
        every: `10 minutes`
      }
    }
  }
});
