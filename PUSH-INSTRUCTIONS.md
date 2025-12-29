# Инструкция по push изменений

## Проблема
У вас нет прав на запись в репозиторий DStukalo/children-server

## Решение 1: Создать форк (РЕКОМЕНДУЕТСЯ)

1. Зайдите на https://github.com/DStukalo/children-server
2. Нажмите кнопку "Fork" (в правом верхнем углу)
3. Это создаст копию репозитория в вашем аккаунте

4. Измените remote на ваш форк:
   ```bash
   git remote set-url origin https://github.com/Ae3232/children-server.git
   ```

5. Запушьте изменения:
   ```bash
   git push origin main
   ```

6. На Render.com подключите ваш форк репозитория

## Решение 2: Деплой без push (альтернатива)

Если не хотите создавать форк, можно:
1. Создать zip архив с кодом
2. Загрузить на Render.com через их интерфейс
3. Или использовать Render CLI

## Решение 3: Получить права

Попросите владельца репозитория (DStukalo) добавить вас как collaborator:
- Settings → Collaborators → Add people
