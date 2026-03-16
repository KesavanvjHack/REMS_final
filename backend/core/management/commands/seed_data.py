"""
Management command: seed_data
Creates demo users (admin, manager, employee), departments, policy, and holidays.
Run: python manage.py seed_data
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import date, timedelta


class Command(BaseCommand):
    help = 'Seed the REMS database with demo data.'

    def handle(self, *args, **options):
        from core.models import User, Department, AttendancePolicy, Holiday

        self.stdout.write('Seeding REMS database...')

        # 1. Departments
        eng, _ = Department.objects.get_or_create(name='Engineering', defaults={'description': 'Software Development'})
        hr, _ = Department.objects.get_or_create(name='Human Resources', defaults={'description': 'HR Department'})
        ops, _ = Department.objects.get_or_create(name='Operations', defaults={'description': 'Operations & IT'})
        self.stdout.write(self.style.SUCCESS('  ✓ Departments created'))

        # 2. Admin User
        if not User.objects.filter(email='admin@rems.com').exists():
            User.objects.create_superuser(
                email='admin@rems.com',
                password='Admin@1234',
                first_name='System',
                last_name='Admin',
                role='admin',
                department=ops,
                is_staff=True,
            )
        self.stdout.write(self.style.SUCCESS('  ✓ Admin user: admin@rems.com / Admin@1234'))

        # 3. Manager User
        manager = None
        if not User.objects.filter(email='manager@rems.com').exists():
            manager = User.objects.create_user(
                email='manager@rems.com',
                password='Manager@1234',
                first_name='Rajesh',
                last_name='Kumar',
                role='manager',
                department=eng,
            )
        else:
            manager = User.objects.get(email='manager@rems.com')
        self.stdout.write(self.style.SUCCESS('  ✓ Manager user: manager@rems.com / Manager@1234'))

        # 4. Employee Users
        employees = [
            {'email': 'employee@rems.com', 'first_name': 'Priya', 'last_name': 'Sharma', 'dept': eng},
            {'email': 'alice@rems.com', 'first_name': 'Alice', 'last_name': 'Johnson', 'dept': eng},
            {'email': 'bob@rems.com', 'first_name': 'Bob', 'last_name': 'Williams', 'dept': hr},
        ]
        for emp_data in employees:
            if not User.objects.filter(email=emp_data['email']).exists():
                User.objects.create_user(
                    email=emp_data['email'],
                    password='Employee@1234',
                    first_name=emp_data['first_name'],
                    last_name=emp_data['last_name'],
                    role='employee',
                    department=emp_data['dept'],
                    manager=manager,
                )
        self.stdout.write(self.style.SUCCESS('  ✓ Employee users: employee@rems.com, alice@rems.com, bob@rems.com / Employee@1234'))

        # 5. Attendance Policy
        if not AttendancePolicy.objects.filter(is_active=True).exists():
            AttendancePolicy.objects.create(
                name='Default Policy',
                min_working_hours=8.00,
                half_day_hours=4.00,
                idle_threshold_minutes=15,
                is_active=True,
            )
        self.stdout.write(self.style.SUCCESS('  ✓ Default attendance policy created'))

        # 6. Holidays
        today = date.today()
        year = today.year
        holidays = [
            {'name': 'Republic Day', 'date': date(year, 1, 26)},
            {'name': 'Holi', 'date': date(year, 3, 14)},
            {'name': 'Independence Day', 'date': date(year, 8, 15)},
            {'name': 'Gandhi Jayanti', 'date': date(year, 10, 2)},
            {'name': 'Diwali', 'date': date(year, 10, 22)},
            {'name': 'Christmas', 'date': date(year, 12, 25)},
        ]
        for h in holidays:
            Holiday.objects.get_or_create(date=h['date'], defaults={'name': h['name']})
        self.stdout.write(self.style.SUCCESS(f'  ✓ {len(holidays)} holidays seeded for {year}'))

        # 7. Seed Expansion Models (Phase 10)
        from core.models import IPWhitelist, Shift, Project, Task
        
        # Shift
        morning_shift, _ = Shift.objects.get_or_create(
            name='Standard Shift', 
            defaults={'start_time': '09:00:00', 'end_time': '18:00:00'}
        )
        
        # IP Whitelist
        IPWhitelist.objects.get_or_create(
            ip_address='192.168.1.100',
            defaults={'description': 'Main Office HQ Gateway'}
        )

        # Projects
        rems_proj, _ = Project.objects.get_or_create(
            name='REMS Web Platform',
            defaults={
                'description': 'Main employee monitoring application build',
                'is_active': True
            }
        )
        
        # Assign Tasks to Employees
        for emp_data in employees:
            emp = User.objects.get(email=emp_data['email'])
            Task.objects.get_or_create(
                title=f"Setup Workplace Dashboard for {emp.first_name}",
                assigned_to=emp,
                project=rems_proj,
                defaults={
                    'description': 'Install dependencies and configure workplace analytics.',
                    'status': 'todo',
                    'due_date': date.today() + timedelta(days=5)
                }
            )
        self.stdout.write(self.style.SUCCESS('  ✓ Projects, Tasks, Shifts, and IP Whitelists seeded'))

        self.stdout.write(self.style.SUCCESS('\n✅ REMS database seeding complete!'))
        self.stdout.write('')
        self.stdout.write('  Credentials:')
        self.stdout.write('  ┌──────────────────────────────────────────┐')
        self.stdout.write('  │  Admin:    admin@rems.com / Admin@1234    │')
        self.stdout.write('  │  Manager:  manager@rems.com / Manager@1234│')
        self.stdout.write('  │  Employee: employee@rems.com / Employee… │')
        self.stdout.write('  └──────────────────────────────────────────┘')
