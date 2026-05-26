import { supabase } from './supabase';

export async function seedDemoData(teamId: string, userId: string) {
  try {
    // Create demo activities
    const activities = [
      {
        team_id: teamId,
        created_by: userId,
        assigned_to: userId,
        title: 'Implementar autenticación',
        description: 'Agregar sistema de login con email y contraseña',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        start_date: '2026-05-01',
        end_date: '2026-05-10',
      },
      {
        team_id: teamId,
        created_by: userId,
        assigned_to: userId,
        title: 'Crear dashboard de usuarios',
        description: 'Panel principal para visualizar información del equipo',
        priority: 'HIGH',
        status: 'PENDING',
        start_date: '2026-05-07',
        end_date: '2026-05-15',
      },
      {
        team_id: teamId,
        created_by: userId,
        assigned_to: userId,
        title: 'Optimizar base de datos',
        description: 'Agregar índices y mejorar queries',
        priority: 'MEDIUM',
        status: 'PENDING',
        start_date: '2026-05-10',
        end_date: '2026-05-20',
      },
      {
        team_id: teamId,
        created_by: userId,
        assigned_to: userId,
        title: 'Documentación API',
        description: 'Crear documentación completa de endpoints',
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
        start_date: '2026-05-05',
        end_date: '2026-05-12',
      },
      {
        team_id: teamId,
        created_by: userId,
        assigned_to: userId,
        title: 'Testing de seguridad',
        description: 'Pruebas de penetración y validación',
        priority: 'HIGH',
        status: 'PENDING',
        start_date: '2026-05-15',
        end_date: '2026-05-25',
      },
      {
        team_id: teamId,
        created_by: userId,
        assigned_to: userId,
        title: 'Refactor de componentes',
        description: 'Mejorar estructura y rendimiento',
        priority: 'LOW',
        status: 'COMPLETED',
        start_date: '2026-04-20',
        end_date: '2026-05-05',
      },
    ];

    const { data: createdActivities } = await supabase
      .from('activities')
      .insert(activities)
      .select();

    if (!createdActivities) return;

    // Add task steps to first activity (Autenticación)
    if (createdActivities[0]) {
      const taskSteps = [
        {
          activity_id: createdActivities[0].id,
          step_type: 'DATABASE',
          title: 'Crear tabla de usuarios',
          description: 'Schema con email, password_hash, created_at',
          order_index: 0,
        },
        {
          activity_id: createdActivities[0].id,
          step_type: 'DATABASE',
          title: 'Crear tabla de sesiones',
          description: 'Para almacenar JWT tokens',
          order_index: 1,
        },
        {
          activity_id: createdActivities[0].id,
          step_type: 'CODE',
          title: 'Implementar endpoints',
          description: '/auth/signup, /auth/login, /auth/logout',
          order_index: 2,
        },
        {
          activity_id: createdActivities[0].id,
          step_type: 'CODE',
          title: 'Middleware de autenticación',
          description: 'Validar JWT en requests',
          order_index: 3,
        },
        {
          activity_id: createdActivities[0].id,
          step_type: 'TESTING',
          title: 'Pruebas unitarias',
          description: 'Cobertura al 80%',
          order_index: 4,
        },
      ];

      await supabase.from('task_steps').insert(taskSteps);
    }

    // Add sample comments
    if (createdActivities[0]) {
      const comments = [
        {
          activity_id: createdActivities[0].id,
          user_id: userId,
          content: 'Comenzar con la tabla de usuarios esta semana',
        },
        {
          activity_id: createdActivities[0].id,
          user_id: userId,
          content: 'Necesitamos validar emails duplicados antes de insertar',
        },
      ];

      await supabase.from('comments').insert(comments);
    }

    // Add sample revision
    if (createdActivities[0]) {
      await supabase.from('activity_revisions').insert({
        activity_id: createdActivities[0].id,
        revision_number: 1,
        status: 'PENDING_REVIEW',
        comments: 'Esperando aprobación de arquitectura',
      });
    }

    console.log('Demo data seeded successfully');
  } catch (error) {
    console.error('Error seeding demo data:', error);
  }
}
