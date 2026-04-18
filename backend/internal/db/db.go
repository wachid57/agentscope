package db

import (
	"fmt"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

type Setting struct {
	Key   string `gorm:"primaryKey" json:"key"`
	Value string `json:"value"`
}

func Init(dsn string) error {
	if dsn == "" {
		return fmt.Errorf("DATABASE_URL is not set")
	}

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return fmt.Errorf("connect postgres: %w", err)
	}

	if err := DB.AutoMigrate(&Setting{}); err != nil {
		return fmt.Errorf("migrate: %w", err)
	}

	log.Println("PostgreSQL connected and migrated")
	return nil
}

func GetSetting(key string) (string, bool) {
	var s Setting
	if err := DB.First(&s, "key = ?", key).Error; err != nil {
		return "", false
	}
	return s.Value, true
}

func SetSetting(key, value string) error {
	return DB.Save(&Setting{Key: key, Value: value}).Error
}

func GetAllSettings() (map[string]string, error) {
	var rows []Setting
	if err := DB.Find(&rows).Error; err != nil {
		return nil, err
	}
	result := make(map[string]string, len(rows))
	for _, r := range rows {
		result[r.Key] = r.Value
	}
	return result, nil
}
