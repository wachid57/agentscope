package db

import (
	"log"

	"gorm.io/gorm"
)

func Migrate(db *gorm.DB) error {
	// Auto-migrate tables
	err := db.AutoMigrate(&User{}, &Role{})
	if err != nil {
		return err
	}

	log.Println("Database migration completed.")
	return nil
}

// User represents the users table
type User struct {
	ID        string `gorm:"primaryKey;size:255"`
	Username  string `gorm:"unique;not null;size:255"`
	Password  string `gorm:"not null;size:255"` // Hashed password
	Email     string `gorm:"unique;size:255"`
	RoleID    string `gorm:"size:255"`
	Role      Role   `gorm:"foreignKey:RoleID"` // Belongs To relationship
	CreatedAt int64  `gorm:"autoCreateTime"`
	UpdatedAt int64  `gorm:"autoUpdateTime"`
}

// Role represents the roles table
type Role struct {
	ID          string `gorm:"primaryKey;size:255"`
	Name        string `gorm:"unique;not null;size:255"`
	Permissions string `gorm:"type:text"` // e.g., JSON string of permissions
	CreatedAt   int64  `gorm:"autoCreateTime"`
	UpdatedAt   int64  `gorm:"autoUpdateTime"`
}
