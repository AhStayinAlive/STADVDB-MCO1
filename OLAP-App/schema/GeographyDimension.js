cube(`GeographyDimension`, {
  sql: `SELECT * FROM dim_geo`,
  
  measures: {
    count: {
      type: `count`,
      drillMembers: [country, stateProvince, city]
    }
  },

  dimensions: {
    geoKey: {
      sql: `${CUBE}.geo_key`,
      type: `string`,
      primaryKey: true,
      title: `Geography Key`
    },
    
    country: {
      sql: `${CUBE}.country`,
      type: `string`,
      title: `Country`
    },
    
    stateProvince: {
      sql: `${CUBE}.state_province`,
      type: `string`,
      title: `State/Province`
    },
    
    city: {
      sql: `${CUBE}.city`,
      type: `string`,
      title: `City`
    },
    
    fullLocation: {
      sql: `CONCAT_WS(', ', ${CUBE}.city, ${CUBE}.state_province, ${CUBE}.country)`,
      type: `string`,
      title: `Full Location`
    }
  }
});
