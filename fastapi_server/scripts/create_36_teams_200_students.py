#!/usr/bin/env python3
"""
36チーム200人の学生データを生成するスクリプト
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from db.session import SessionLocal
from db import models
import random


def create_teams_and_students():
    """36チームと200人の学生データを作成"""
    db: Session = SessionLocal()

    try:
        print("Creating 36 teams and 200 students...")

        # 既存の関連データをクリア（外部キー制約を考慮）
        db.query(models.CellExecution).delete()
        db.query(models.Session).delete()
        db.query(models.Student).delete()
        db.query(models.Team).delete()
        db.commit()

        # 36チームを作成
        teams = []
        for i in range(1, 37):  # team_001 to team_036
            team = models.Team(
                team_id=f"team_{i:03d}", description=f"チーム{i:03d}の説明"
            )
            db.add(team)
            teams.append(team)

        db.commit()  # チームを先にコミット

        # 200人の学生を作成（各チーム平均5-6人）
        student_names = [
            "田中太郎",
            "佐藤花子",
            "山田次郎",
            "鈴木一郎",
            "高橋美咲",
            "渡辺健",
            "伊藤由美",
            "中村真一",
            "小林恵子",
            "加藤雄介",
            "吉田香織",
            "山本直樹",
            "松本純子",
            "井上和也",
            "木村麻衣",
            "林大輔",
            "清水愛",
            "山口翔太",
            "森下千恵",
            "池田良太",
            "橋本舞",
            "石川拓也",
            "前田美穂",
            "藤井浩",
            "西村真理",
            "岡田達也",
            "長谷川優",
            "村上孝",
            "近藤美紀",
            "斎藤健太",
        ]

        # 200人を36チームに分配: 16チームは6人(96人) + 16チームは5人(80人) + 4チームは6人(24人) = 200人
        students_per_team = [6] * 20 + [5] * 16  # 20チームは6人、16チームは5人で計200人
        random.shuffle(students_per_team)

        student_counter = 1

        for team_idx, team in enumerate(teams):
            num_students = students_per_team[team_idx]

            for j in range(num_students):
                student_name = random.choice(student_names) + str(student_counter)
                student = models.Student(
                    user_id=f"student_{student_counter:03d}",
                    name=student_name,
                    email=f"student{student_counter:03d}@example.com",
                    team_id=team.id,
                )
                db.add(student)
                student_counter += 1

        db.commit()

        # 作成結果を確認
        total_teams = db.query(models.Team).count()
        total_students = db.query(models.Student).count()

        print(f"✅ Successfully created:")
        print(f"   - Teams: {total_teams}")
        print(f"   - Students: {total_students}")

        # チームごとの学生数を表示
        print("\n📊 Students per team:")
        for team in teams:
            student_count = (
                db.query(models.Student)
                .filter(models.Student.team_id == team.id)
                .count()
            )
            print(f"   {team.team_id}: {student_count} students")

    except Exception as e:
        print(f"❌ Error creating teams and students: {e}")
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    create_teams_and_students()
