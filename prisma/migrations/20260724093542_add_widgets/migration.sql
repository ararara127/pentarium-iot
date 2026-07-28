-- CreateTable
CREATE TABLE `DashboardWidget` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `deviceId` VARCHAR(191) NULL,
    `metric` VARCHAR(191) NULL,
    `config` JSON NULL,
    `width` VARCHAR(191) NOT NULL DEFAULT 'half',
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DashboardWidget_tenantId_position_idx`(`tenantId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DashboardWidget` ADD CONSTRAINT `DashboardWidget_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Device`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
