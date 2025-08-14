#!/usr/bin/env python3
"""
メールアドレスベースでチーム名と学生データを生成するスクリプト
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from db.session import SessionLocal
from db import models
import random


def create_email_based_teams_and_students():
    """チーム名ベースで36チームと200人の学生データを作成"""
    db: Session = SessionLocal()

    try:
        print("Creating email-based teams and students...")

        # 36チーム名を作成
        team_names = [
            "チームA",
            "チームB",
            "チームC",
            "チームD",
            "チームE",
            "チームF",
            "チームG",
            "チームH",
            "チームI",
            "チームJ",
            "チームK",
            "チームL",
            "チームM",
            "チームN",
            "チームO",
            "チームP",
            "チームQ",
            "チームR",
            "チームS",
            "チームT",
            "チームU",
            "チームV",
            "チームW",
            "チームX",
            "チームY",
            "チームZ",
            "チーム1",
            "チーム2",
            "チーム3",
            "チーム4",
            "チーム5",
            "チーム6",
            "チーム7",
            "チーム8",
            "チーム9",
            "チーム10",
        ]

        teams = []
        for team_name in team_names:
            team = models.Team(team_name=team_name, description=f"{team_name}の説明")
            db.add(team)
            teams.append(team)

        db.commit()  # チームを先にコミット

        # 200人の学生をメールアドレスベースで作成
        base_names = [
            "田中",
            "佐藤",
            "山田",
            "鈴木",
            "高橋",
            "渡辺",
            "伊藤",
            "中村",
            "小林",
            "加藤",
            "吉田",
            "山本",
            "松本",
            "井上",
            "木村",
            "林",
            "清水",
            "山口",
            "森",
            "池田",
            "橋本",
            "石川",
            "前田",
            "藤井",
            "西村",
            "岡田",
            "長谷川",
            "村上",
            "近藤",
            "斎藤",
        ]

        students_per_team = [6] * 20 + [5] * 16  # 20チームは6人、16チームは5人で計200人
        random.shuffle(students_per_team)

        student_counter = 1

        for team_idx, team in enumerate(teams):
            num_students = students_per_team[team_idx]

            for j in range(num_students):
                base_name = random.choice(base_names)
                student_name = f"{base_name}{student_counter:03d}"
                email = f"student{student_counter:03d}@example.com"

                student = models.Student(
                    email=email, name=student_name, team_id=team.id
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

        # チームごとの学生数とサンプルを表示
        print("\n📊 Teams and students:")
        for team in teams[:10]:  # 最初の10チームのみ表示
            student_count = (
                db.query(models.Student)
                .filter(models.Student.team_id == team.id)
                .count()
            )
            sample_student = (
                db.query(models.Student)
                .filter(models.Student.team_id == team.id)
                .first()
            )
            sample_email = sample_student.email if sample_student else "N/A"
            print(
                f"   {team.team_name}: {student_count} students (sample: {sample_email})"
            )

        if len(teams) > 10:
            print(f"   ... and {len(teams) - 10} more teams")

    except Exception as e:
        print(f"❌ Error creating teams and students: {e}")
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    create_email_based_teams_and_students()
